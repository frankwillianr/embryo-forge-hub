import { createClient } from "jsr:@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// Agente Buscador — Pipeline V2
// ═══════════════════════════════════════════════════════════════════════════════
//
// Recebe: { cidade_id: string, max_articles?: number }
// Busca fontes dinâmicas da tabela cidade_scraping_fonte_v2
// Suporta tipo: "rss" | "html" | "auto"
// Retorna lista de artigos crus para o próximo agente processar
// ═══════════════════════════════════════════════════════════════════════════════

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9",
  "Cache-Control": "no-cache",
};

const MAX_ARTICLES_DEFAULT = 50;
const FETCH_TIMEOUT_MS = 12_000;

// ─── Types ────────────────────────────────────────────────────────────────────

interface FonteRow {
  id: string;
  cidade_id: string;
  nome: string;
  url: string;
  tipo: "rss" | "html" | "auto";
  ativo: boolean;
  ordem: number;
}

interface ArtigoColetado {
  url: string;
  titulo: string | null;
  descricao: string | null;
  imagem_url: string | null;
  data_publicacao: string | null;
  fonte_nome: string;
  fonte_url: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectTipo(url: string): "rss" | "html" {
  const lower = url.toLowerCase();
  if (
    lower.includes("/rss") ||
    lower.includes("/feed") ||
    lower.endsWith(".xml") ||
    lower.includes("atom")
  ) {
    return "rss";
  }
  return "html";
}

function fetchWithTimeout(url: string, ms = FETCH_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { headers: BROWSER_HEADERS, signal: ctrl.signal }).finally(
    () => clearTimeout(timer)
  );
}

function textBetween(
  html: string,
  open: string,
  close: string
): string | null {
  const start = html.indexOf(open);
  if (start === -1) return null;
  const end = html.indexOf(close, start + open.length);
  if (end === -1) return null;
  return html.slice(start + open.length, end).trim();
}

function extractMetaContent(html: string, property: string): string | null {
  const patterns = [
    `property="${property}" content="`,
    `name="${property}" content="`,
    `property='${property}' content='`,
  ];
  for (const pat of patterns) {
    const val = textBetween(html, pat, property.includes("og:") ? '"' : '"');
    if (val) return val;
  }
  // fallback: content before property
  const altPat = `content="`;
  const propIdx = html.indexOf(`property="${property}"`);
  if (propIdx !== -1) {
    const slice = html.slice(Math.max(0, propIdx - 200), propIdx);
    const lastContent = slice.lastIndexOf('content="');
    if (lastContent !== -1) {
      const val = textBetween(
        slice.slice(lastContent),
        'content="',
        '"'
      );
      if (val) return val;
    }
  }
  return null;
}

// ─── RSS Collector ────────────────────────────────────────────────────────────

async function coletarRSS(fonte: FonteRow): Promise<ArtigoColetado[]> {
  const res = await fetchWithTimeout(fonte.url);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${fonte.url}`);
  const xml = await res.text();

  const items: ArtigoColetado[] = [];
  let cursor = 0;

  while (true) {
    const itemStart = xml.indexOf("<item", cursor);
    if (itemStart === -1) break;
    const itemEnd = xml.indexOf("</item>", itemStart);
    if (itemEnd === -1) break;
    cursor = itemEnd + 7;

    const chunk = xml.slice(itemStart, itemEnd + 7);

    const url =
      textBetween(chunk, "<link>", "</link>") ||
      textBetween(chunk, "<link ", "/>") ||
      null;
    if (!url || !url.startsWith("http")) continue;

    const titulo =
      textBetween(chunk, "<title><![CDATA[", "]]></title>") ||
      textBetween(chunk, "<title>", "</title>") ||
      null;

    const descricao =
      textBetween(chunk, "<description><![CDATA[", "]]></description>") ||
      textBetween(chunk, "<description>", "</description>") ||
      null;

    const imagem_url =
      textBetween(chunk, '<media:content url="', '"') ||
      textBetween(chunk, '<enclosure url="', '"') ||
      null;

    const data_publicacao =
      textBetween(chunk, "<pubDate>", "</pubDate>") ||
      textBetween(chunk, "<dc:date>", "</dc:date>") ||
      null;

    items.push({
      url: url.trim(),
      titulo: titulo ? titulo.replace(/<[^>]+>/g, "").trim() : null,
      descricao: descricao
        ? descricao.replace(/<[^>]+>/g, "").trim().slice(0, 500)
        : null,
      imagem_url,
      data_publicacao,
      fonte_nome: fonte.nome,
      fonte_url: fonte.url,
    });
  }

  return items;
}

// ─── HTML Collector ───────────────────────────────────────────────────────────

async function coletarHTML(fonte: FonteRow): Promise<ArtigoColetado[]> {
  const res = await fetchWithTimeout(fonte.url);
  if (!res.ok) throw new Error(`HTTP ${res.status} em ${fonte.url}`);
  const html = await res.text();

  const baseUrl = new URL(fonte.url);
  const links = new Set<string>();

  // Extract all <a href> that look like article links
  const hrefRe = /href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    let href = m[1];
    if (!href || href.startsWith("#") || href.startsWith("javascript"))
      continue;
    if (!href.startsWith("http")) {
      try {
        href = new URL(href, baseUrl).href;
      } catch {
        continue;
      }
    }
    // Keep only links from the same domain that look like articles (have a path)
    try {
      const u = new URL(href);
      if (
        u.hostname === baseUrl.hostname &&
        u.pathname.length > 1 &&
        !u.pathname.match(/\.(css|js|png|jpg|jpeg|gif|svg|ico|pdf|mp4|webp)$/i)
      ) {
        links.add(href.split("?")[0].split("#")[0]);
      }
    } catch {
      // skip
    }
  }

  // For each unique link, create a minimal candidate
  const items: ArtigoColetado[] = [];
  for (const url of links) {
    items.push({
      url,
      titulo: null,
      descricao: null,
      imagem_url: null,
      data_publicacao: null,
      fonte_nome: fonte.nome,
      fonte_url: fonte.url,
    });
  }

  return items;
}

// ─── Enrich article (fetch og:title / og:description / og:image) ──────────────

async function enrichArtigo(artigo: ArtigoColetado): Promise<ArtigoColetado> {
  // Only enrich HTML-collected articles (RSS already has data)
  if (artigo.titulo) return artigo;

  try {
    const res = await fetchWithTimeout(artigo.url, 8_000);
    if (!res.ok) return artigo;
    // Read only first 50KB to avoid memory issues
    const reader = res.body?.getReader();
    if (!reader) return artigo;

    let html = "";
    let bytes = 0;
    while (bytes < 50_000) {
      const { done, value } = await reader.read();
      if (done) break;
      html += new TextDecoder().decode(value);
      bytes += value.length;
    }
    reader.cancel();

    artigo.titulo =
      extractMetaContent(html, "og:title") ||
      textBetween(html, "<title>", "</title>") ||
      null;
    artigo.descricao =
      extractMetaContent(html, "og:description") ||
      extractMetaContent(html, "description") ||
      null;
    artigo.imagem_url =
      extractMetaContent(html, "og:image") || null;
  } catch {
    // enrichment failed — return what we have
  }

  return artigo;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = await req.json();
    const cidade_id: string = body.cidade_id;
    const max_articles: number = body.max_articles ?? MAX_ARTICLES_DEFAULT;
    const enrich: boolean = body.enrich ?? false; // opt-in: enrich HTML articles

    if (!cidade_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "cidade_id obrigatorio" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Carregar fontes dinâmicas da cidade
    const { data: fontes, error: fontesError } = await supabase
      .from("cidade_scraping_fonte_v2")
      .select("*")
      .eq("cidade_id", cidade_id)
      .eq("ativo", true)
      .order("ordem");

    if (fontesError) throw fontesError;
    if (!fontes || fontes.length === 0) {
      return new Response(
        JSON.stringify({
          ok: true,
          artigos: [],
          total: 0,
          mensagem: "Nenhuma fonte ativa cadastrada para esta cidade",
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // 2. Coletar artigos de cada fonte
    const logs: string[] = [];
    const todoArtigos: ArtigoColetado[] = [];

    await Promise.allSettled(
      (fontes as FonteRow[]).map(async (fonte) => {
        try {
          const tipo =
            fonte.tipo === "auto" ? detectTipo(fonte.url) : fonte.tipo;
          const coletados =
            tipo === "rss"
              ? await coletarRSS(fonte)
              : await coletarHTML(fonte);

          logs.push(`[${fonte.nome}] ${coletados.length} artigos coletados`);
          todoArtigos.push(...coletados);
        } catch (err) {
          logs.push(`[${fonte.nome}] ERRO: ${String(err)}`);
        }
      })
    );

    // 3. Deduplicar por URL
    const seen = new Set<string>();
    const unicos = todoArtigos.filter((a) => {
      if (seen.has(a.url)) return false;
      seen.add(a.url);
      return true;
    });

    // 4. Limitar
    const limitados = unicos.slice(0, max_articles);

    // 5. Enrich (opcional — ativa com enrich: true no body)
    let artigos = limitados;
    if (enrich) {
      artigos = await Promise.all(limitados.map(enrichArtigo));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        artigos,
        total: artigos.length,
        fontes_consultadas: fontes.length,
        logs,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      }
    );
  }
});
