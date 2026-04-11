import { createClient } from "jsr:@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// Agente Buscador 01 — Pipeline V2
// ═══════════════════════════════════════════════════════════════════════════════
//
// Recebe: { cidade_id: string, max_articles?: number, lookback_days?: number }
//
// Estratégia por tipo de fonte:
//   RSS  → parse XML → extrai título, descrição, imagens, data direto do feed
//          → depois enriquece com fetch do artigo para mais imagens
//   HTML → fetch da página de listagem → extrai links de artigos
//          → fetch individual de cada artigo para título, descrição, imagens
//
// Técnicas de extração (em ordem de prioridade):
//   1. JSON-LD (application/ld+json) — mais confiável, usado por grandes portais
//   2. Open Graph meta tags (og:title, og:description, og:image)
//   3. Meta tags padrão (name="description")
//   4. H1 + <title> como fallback de título
//   5. Imagens do corpo do artigo (<article>, .entry-content, etc.)
//
// Salva em: tabela_agente_buscador com UPSERT (não duplica por URL)
// ═══════════════════════════════════════════════════════════════════════════════

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
  "Cache-Control": "no-cache",
};

const FETCH_TIMEOUT_MS = 14_000;
const ARTICLE_FETCH_TIMEOUT_MS = 10_000;
const CONCURRENCY = 8; // artigos enriquecidos em paralelo
const MAX_ARTICLES_DEFAULT = 120;
const LOOKBACK_DAYS_DEFAULT = 3;
const MAX_IMAGES_PER_ARTICLE = 1;
const ARTICLE_READ_MAX_BYTES = 260_000;

// ─── Image blocklist (logos, ícones, tracking, social, etc.) ─────────────────

const BLOCKED_IMG_RE =
  /(\/logo[s]?\/|\/icon[s]?\/|\/favicon|avatar|telegram[-_.]|instagram[-_.]|facebook[-_.]|twitter[-_.]|tiktok[-_.]|youtube[-_.]|linkedin[-_.]|pinterest[-_.]|pixel|tracking|badge|social[-_]|share[-_]|\/ads\/|advertisement|placeholder|default[-_]img|spinner|loading|widget|banner[-_]lateral|i\.imgur\.com)/i;

const BLOCKED_IMG_EXT_RE = /\.(gif|svg|ico)(\?.*)?$/i;
const VIDEO_THUMB_RE = /video\.glbimg\.com\/(?:.*\/)?x\d{2,4}\//i;
const G1_PRIVATE_RE = /^https?:\/\/i\.s3\.glbimg\.com\/v1\/AUTH_[^/]+\/internal_photos\//i;

// ─── Types ────────────────────────────────────────────────────────────────────

interface FonteRow {
  id: string;
  cidade_id: string;
  nome: string;
  url: string;
  tipo: "rss" | "html" | "auto";
}

interface Candidato {
  url: string;
  fonte_id: string;
  fonte_nome: string;
  // pré-dados do RSS (podem ser nulos em fontes HTML)
  titulo?: string;
  descricao?: string;
  imagem_rss?: string;
  data_publicacao?: string;
}

interface ArtigoFinal {
  cidade_id: string;
  fonte_id: string;
  fonte_nome: string;
  url: string;
  titulo: string | null;
  descricao: string | null;
  lista_imagens: string[];
  data_publicacao: string | null;
  status: "coletado";
}

interface CidadeRef {
  id: string;
  nome: string;
  slug: string | null;
}

// ─── Fetch helpers ────────────────────────────────────────────────────────────

async function fetchSafe(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: ctrl.signal, headers: BROWSER_HEADERS });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Lê até maxBytes do body sem carregar o arquivo inteiro na memória */
async function readPartial(res: Response, maxBytes = 80_000): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return await res.text();
  const decoder = new TextDecoder();
  let html = "";
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      html += decoder.decode(value, { stream: true });
      total += value.length;
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  return html;
}

// ─── HTML utilities ───────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function getMeta(html: string, prop: string): string {
  for (const re of [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']{1,1000})["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']{1,1000})["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
  ]) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return "";
}

function cleanTitle(raw: string): string {
  return decodeEntities(raw)
    .replace(/<[^>]+>/g, "")
    .replace(/\s*[-|–—]\s*(Diário do Rio Doce|G1 Vales|G1|Jornal da Cidade|DeFato Online|Globo\.com|Portal|DRD)[^$]*/i, "")
    .trim();
}

// ─── 1. JSON-LD extraction (mais confiável para portais de notícia) ───────────

function normalizeText(raw: string): string {
  return (raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizePhrase(raw: string): string {
  return normalizeText(raw).trim();
}

function hasPhrase(textNorm: string, phraseNorm: string): boolean {
  if (!phraseNorm) return false;
  return (` ${textNorm} `).includes(` ${phraseNorm} `);
}

function buildTargetTokens(cityName: string): string[] {
  return normalizeText(cityName)
    .split(" ")
    .filter((t) => t.length >= 4);
}

function getHostnameSafe(raw: string): string {
  try {
    return new URL(raw).hostname.toLowerCase();
  } catch {
    return "";
  }
}

const NON_ARTICLE_SEGMENTS = new Set([
  "feed", "rss", "category", "categoria", "tag", "tags",
  "author", "autor", "arquivo", "arquivos", "search", "busca",
  "page", "pagina", "wp-admin", "wp-content", "wp-includes", "wp-json",
  "videos", "video", "canais", "impressos", "colunas", "coluna",
  "colunista", "colunistas",
]);
const NON_ARTICLE_PATH_RE =
  /(^|\/)(feed|rss|category|categoria|tag|tags|author|autor|arquivo|arquivos|search|busca|page|pagina|wp-admin|wp-content|wp-includes|wp-json|videos?|canais|impressos|colunas?|coluna|colunistas?)(\/|-|$)/i;

function isLikelyArticleUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    const pathname = url.pathname.toLowerCase().replace(/\/+$/, "");
    if (!pathname || pathname === "/") return false;
    if (/\.(css|js|png|jpg|jpeg|gif|svg|ico|pdf|mp4|webp|xml)(\?.*)?$/i.test(pathname)) return false;
    if (NON_ARTICLE_PATH_RE.test(pathname)) return false;

    const segments = pathname.split("/").filter(Boolean);
    if (!segments.length) return false;
    if (segments.some((s) => NON_ARTICLE_SEGMENTS.has(s))) return false;

    const last = segments[segments.length - 1].replace(/\.(html?)$/i, "");
    if (!last || /^\d+$/.test(last)) return false;
    if (last.length < 8) return false;
    if (last.split("-").filter(Boolean).length < 2) return false;

    return true;
  } catch {
    return false;
  }
}

function buildSourceHostAllowlist(fontes: FonteRow[]): Set<string> {
  const hosts = new Set<string>();
  for (const f of fontes) {
    const host = getHostnameSafe(f.url);
    if (!host) continue;
    hosts.add(host);
    // Permite subdomínios da mesma origem editorial
    if (host.startsWith("www.")) hosts.add(host.replace(/^www\./, ""));
  }
  return hosts;
}

function isFromTrustedSource(articleUrl: string, sourceHostAllowlist: Set<string>): boolean {
  const host = getHostnameSafe(articleUrl);
  if (!host) return false;
  if (sourceHostAllowlist.has(host)) return true;
  if (host.startsWith("www.") && sourceHostAllowlist.has(host.replace(/^www\./, ""))) return true;
  return false;
}

function listOtherCityPhrases(cidades: CidadeRef[], targetCidadeId: string): string[] {
  const out = new Set<string>();
  for (const c of cidades) {
    if (c.id === targetCidadeId) continue;
    const nome = normalizePhrase(c.nome);
    const slug = normalizePhrase((c.slug ?? "").replace(/-/g, " "));
    if (nome.length >= 5) out.add(nome);
    if (slug.length >= 5) out.add(slug);
  }
  return [...out];
}

function isRelevantToCidade(
  artigo: ArtigoFinal,
  cidadeNome: string,
  cidadeSlug: string | null,
  otherCityPhrases: string[],
  sourceHostAllowlist: Set<string>
): { ok: boolean; reason: string } {
  if (!isLikelyArticleUrl(artigo.url)) {
    return { ok: false, reason: "url-nao-artigo" };
  }

  const corpus = normalizeText(
    `${artigo.url} ${artigo.fonte_nome} ${artigo.titulo ?? ""} ${artigo.descricao ?? ""}`
  );

  const targetName = normalizePhrase(cidadeNome);
  const targetSlug = normalizePhrase((cidadeSlug ?? "").replace(/-/g, " "));
  const hasTargetName = hasPhrase(corpus, targetName);
  const hasTargetSlug = targetSlug ? hasPhrase(corpus, targetSlug) : false;

  const targetTokens = buildTargetTokens(cidadeNome);
  const tokenHits = targetTokens.filter((t) => hasPhrase(corpus, t)).length;
  const hasTargetTokenSignal = tokenHits >= 1;
  const hasOtherCityMention = otherCityPhrases.some((p) => hasPhrase(corpus, p));
  const trustedSource = isFromTrustedSource(artigo.url, sourceHostAllowlist);
  const titleNorm = normalizeText(artigo.titulo ?? "");
  if (/^arquivo(s)?\b/.test(titleNorm)) {
    return { ok: false, reason: "titulo-arquivo" };
  }

  const hasStrongTargetSignal = hasTargetName || hasTargetSlug || hasTargetTokenSignal;
  if (hasStrongTargetSignal) {
    if (hasOtherCityMention && !(hasTargetName || hasTargetSlug)) {
      return { ok: false, reason: "mencao-outra-cidade" };
    }
    return { ok: true, reason: "ok-sinal-forte" };
  }

  // Fallback: se for fonte local confiável e não houver menção de outra cidade, aceita.
  if (trustedSource && tokenHits >= 1 && !hasOtherCityMention) {
    return { ok: true, reason: "ok-fonte-confiavel-com-token" };
  }

  if (hasOtherCityMention) {
    return { ok: false, reason: "mencao-outra-cidade" };
  }

  return { ok: false, reason: "sem-mencao-cidade" };
}

interface JsonLdArticle {
  "@type"?: string;
  headline?: string;
  description?: string;
  image?: string | string[] | { url?: string } | { url?: string }[];
  datePublished?: string;
}

function parseJsonLd(html: string): JsonLdArticle | null {
  const scripts = html.match(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  ) ?? [];

  for (const block of scripts) {
    try {
      const inner = block.replace(/<[^>]+>/g, "");
      const parsed = JSON.parse(inner);
      const candidates: unknown[] = Array.isArray(parsed["@graph"])
        ? parsed["@graph"]
        : [parsed];
      for (const c of candidates) {
        const obj = c as JsonLdArticle;
        const type = obj["@type"] ?? "";
        if (
          typeof type === "string" &&
          (type.toLowerCase().includes("article") ||
            type.toLowerCase().includes("newsarticle") ||
            type.toLowerCase().includes("reportage"))
        ) {
          return obj;
        }
      }
    } catch {
      // malformed JSON — skip
    }
  }
  return null;
}

function jsonLdImages(ld: JsonLdArticle): string[] {
  const raw = ld.image;
  if (!raw) return [];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) {
    return raw.map((r) => (typeof r === "string" ? r : r.url ?? "")).filter(Boolean);
  }
  if (typeof raw === "object" && "url" in raw) return [raw.url ?? ""].filter(Boolean);
  return [];
}

// ─── 2. Full article body text extraction ────────────────────────────────────

function extractArticleText(html: string): string {
  // Remove ruído antes de tentar isolar o corpo
  let clean = html
    .replace(/<(script|style|noscript|nav|header|footer|aside|form|figure)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Tenta isolar o bloco de conteúdo editorial
  for (const re of [
    /<article[^>]*>([\s\S]{300,}?)<\/article>/i,
    /class=["'][^"']*(?:entry-content|post-content|article-body|article-text|materia-texto|corpo-texto|td-post-content|single-content|conteudo-materia|content-body|post-entry)[^"']*["'][^>]*>([\s\S]{300,})/i,
    /itemprop=["']articleBody["'][^>]*>([\s\S]{300,})/i,
    /<main[^>]*>([\s\S]{300,}?)<\/main>/i,
  ]) {
    const m = clean.match(re);
    if (m?.[1]) { clean = m[1]; break; }
  }

  // Remove tags restantes, colapsa espaços e retorna texto limpo
  return clean
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/[\t\r\n]+/g, " ")
    .trim();
}

// ─── 3. Article-body image extraction ─────────────────────────────────────────

function toAbsolute(raw: string, base: string): string {
  const clean = decodeEntities(raw ?? "").trim();
  if (!clean || clean.startsWith("data:")) return "";
  try {
    return new URL(clean, base).href;
  } catch {
    return "";
  }
}

function isBlockedImage(url: string): boolean {
  if (!url?.startsWith("http")) return true;
  if (BLOCKED_IMG_RE.test(url)) return true;
  if (BLOCKED_IMG_EXT_RE.test(url)) return true;
  if (VIDEO_THUMB_RE.test(url)) return true;
  if (G1_PRIVATE_RE.test(url)) return true;
  return false;
}

function extractArticleImages(html: string, baseUrl: string): string[] {
  // Isolate article body to avoid pulling nav/sidebar images
  let body = html;
  for (const re of [
    /<article[^>]*>([\s\S]{200,}?)<\/article>/i,
    /class=["'][^"']*(?:entry-content|post-content|article-body|materia-texto|corpo-texto|td-post-content|single-content|conteudo)[^"']*["'][^>]*>([\s\S]{200,})/i,
    /itemprop=["']articleBody["'][^>]*>([\s\S]{200,})/i,
  ]) {
    const m = html.match(re);
    if (m?.[1]) { body = m[1]; break; }
  }

  const imgs: string[] = [];
  const imgRe = /<img[^>]+(?:src|data-src|data-lazy-src)=["']([^"']{10,})["'][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(body)) !== null) {
    const abs = toAbsolute(m[1], baseUrl);
    if (abs && !isBlockedImage(abs)) imgs.push(abs);
  }
  // Also check srcset
  const srcsetRe = /srcset=["']([^"']+)["']/gi;
  while ((m = srcsetRe.exec(body)) !== null) {
    const first = m[1].trim().split(/[\s,]+/)[0];
    if (first) {
      const abs = toAbsolute(first, baseUrl);
      if (abs && !isBlockedImage(abs)) imgs.push(abs);
    }
  }

  return [...new Set(imgs)];
}

function rankAndSelectImages(
  articleUrl: string,
  dataPublicacao: string | null,
  images: string[]
): string[] {
  const articleHost = getHostnameSafe(articleUrl);
  const [year = "", month = ""] = (dataPublicacao ?? "").split("-");
  const yearMonth = year && month ? `${year}/${month}` : "";

  const scored = images.map((url, idx) => {
    let score = 0;
    const host = getHostnameSafe(url);
    const lower = url.toLowerCase();

    if (host && articleHost && (host === articleHost || host === `www.${articleHost}` || articleHost === `www.${host}`)) score += 4;
    if (/(\/wp-content\/uploads\/|\/uploads\/)/i.test(lower)) score += 3;
    if (yearMonth && lower.includes(yearMonth)) score += 2;
    // pequeno desempate para manter estabilidade na ordem original
    score += Math.max(0, 0.5 - idx * 0.01);

    return { url, score, idx };
  });

  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  return scored.map((s) => s.url);
}

// ─── 3. Full article enrichment ───────────────────────────────────────────────

async function enrichArtigo(
  candidato: Candidato,
  cidadeId: string
): Promise<ArtigoFinal> {
  const fallback: ArtigoFinal = {
    cidade_id: cidadeId,
    fonte_id: candidato.fonte_id,
    fonte_nome: candidato.fonte_nome,
    url: candidato.url,
    titulo: candidato.titulo ?? null,
    descricao: candidato.descricao ?? null,
    lista_imagens: candidato.imagem_rss ? [candidato.imagem_rss] : [],
    data_publicacao: candidato.data_publicacao ?? null,
    status: "coletado",
  };

  const res = await fetchSafe(candidato.url, ARTICLE_FETCH_TIMEOUT_MS);
  if (!res?.ok) return fallback;

  const html = await readPartial(res, ARTICLE_READ_MAX_BYTES);

  // — JSON-LD (primeira prioridade) —
  const ld = parseJsonLd(html);
  const ldImages = ld ? jsonLdImages(ld) : [];

  // — título —
  const titulo =
    (ld?.headline ? cleanTitle(ld.headline) : "") ||
    cleanTitle(getMeta(html, "og:title")) ||
    cleanTitle(html.match(/<h1[^>]*>([^<]{5,200}?)<\/h1>/i)?.[1] ?? "") ||
    cleanTitle(html.match(/<title[^>]*>([^<]{5,200})<\/title>/i)?.[1] ?? "") ||
    candidato.titulo ||
    null;

  // — descrição (prioridade: corpo completo da matéria → og:description → RSS) —
  const bodyText = extractArticleText(html);
  const descricao =
    (bodyText.length > 100 ? bodyText : null) ||
    ld?.description ||
    getMeta(html, "og:description") ||
    getMeta(html, "description") ||
    candidato.descricao ||
    null;

  // — data —
  let dataPublicacao = candidato.data_publicacao ?? null;
  if (!dataPublicacao) {
    const d =
      ld?.datePublished ||
      getMeta(html, "article:published_time") ||
      getMeta(html, "datePublished") ||
      html.match(/<time[^>]+datetime=["'](\d{4}-\d{2}-\d{2}[^"']*)["']/i)?.[1] ||
      "";
    if (d) dataPublicacao = d.slice(0, 10);
  }

  // — imagens (prioridade: og:image → JSON-LD → corpo do artigo) —
  const ogImage = getMeta(html, "og:image");
  const bodyImages = extractArticleImages(html, candidato.url);

  const ogPrincipal = ogImage && !isBlockedImage(ogImage) ? ogImage : null;
  const allImages = [
    ...(ogPrincipal ? [ogPrincipal] : []),
    ...ldImages.filter((u) => !isBlockedImage(u)),
    ...bodyImages,
    ...(candidato.imagem_rss && !isBlockedImage(candidato.imagem_rss)
      ? [candidato.imagem_rss]
      : []),
  ];

  const dedup = [...new Set(allImages)];
  const ranked = rankAndSelectImages(candidato.url, dataPublicacao, dedup);
  const listaImagens = [
    ...(ogPrincipal ? [ogPrincipal] : []),
    ...ranked.filter((u) => !ogPrincipal || u !== ogPrincipal),
  ].slice(0, MAX_IMAGES_PER_ARTICLE);

  return {
    cidade_id: cidadeId,
    fonte_id: candidato.fonte_id,
    fonte_nome: candidato.fonte_nome,
    url: candidato.url,
    titulo: titulo?.trim() || null,
    descricao: descricao?.replace(/<[^>]+>/g, " ").replace(/\s{2,}/g, " ").trim() || null,
    lista_imagens: listaImagens,
    data_publicacao: dataPublicacao,
    status: "coletado",
  };
}

// ─── RSS collector ────────────────────────────────────────────────────────────

async function coletarRSS(fonte: FonteRow): Promise<Candidato[]> {
  const res = await fetchSafe(fonte.url);
  if (!res?.ok) throw new Error(`HTTP ${res?.status ?? "timeout"} em ${fonte.url}`);
  const xml = await res.text();

  const candidatos: Candidato[] = [];
  let cursor = 0;

  while (true) {
    const start = xml.indexOf("<item", cursor);
    if (start === -1) break;
    const end = xml.indexOf("</item>", start);
    if (end === -1) break;
    cursor = end + 7;
    const chunk = xml.slice(start, end + 7);

    const link =
      xml.slice(start, end + 7).match(/<link>(https?:\/\/[^<]+)<\/link>/i)?.[1]?.trim() ||
      chunk.match(/href=["'](https?:\/\/[^"']+)["']/i)?.[1]?.trim() ||
      null;
    if (!link) continue;
    if (!isLikelyArticleUrl(link)) continue;

    const titulo =
      (chunk.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/i)?.[1] ||
       chunk.match(/<title>([^<]{3,})<\/title>/i)?.[1] ||
       "").trim();

    const descricao =
      (chunk.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/i)?.[1] ||
       chunk.match(/<description>([^<]{3,})<\/description>/i)?.[1] ||
       "").replace(/<[^>]+>/g, "").trim().slice(0, 600);

    const imagem_rss =
      chunk.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1] ||
      chunk.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1] ||
      getMeta(chunk, "og:image") ||
      undefined;

    const pubRaw =
      chunk.match(/<pubDate>([^<]+)<\/pubDate>/i)?.[1] ||
      chunk.match(/<dc:date>([^<]+)<\/dc:date>/i)?.[1] ||
      "";
    const data_publicacao = pubRaw
      ? new Date(pubRaw).toISOString().slice(0, 10)
      : undefined;

    candidatos.push({
      url: link,
      fonte_id: fonte.id,
      fonte_nome: fonte.nome,
      titulo: titulo || undefined,
      descricao: descricao || undefined,
      imagem_rss,
      data_publicacao,
    });
  }

  return candidatos;
}

// ─── HTML listing collector ───────────────────────────────────────────────────

async function coletarHTML(fonte: FonteRow): Promise<Candidato[]> {
  const res = await fetchSafe(fonte.url);
  if (!res?.ok) throw new Error(`HTTP ${res?.status ?? "timeout"} em ${fonte.url}`);
  const html = await readPartial(res, 100_000);
  const base = new URL(fonte.url);
  const candidatos: Candidato[] = [];

  // Se a página expõe RSS alternativo, aproveita para coletar links de notícia com mais precisão.
  const rssHref =
    html.match(/<link[^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ||
    html.match(/<link[^>]+href=["']([^"']+)["'][^>]+type=["']application\/(?:rss|atom)\+xml["'][^>]*>/i)?.[1] ||
    "";

  if (rssHref) {
    try {
      const rssUrl = new URL(rssHref, base).href;
      const rssHost = new URL(rssUrl).hostname;
      if (rssHost === base.hostname) {
        const rssCandidates = await coletarRSS({ ...fonte, url: rssUrl, tipo: "rss" });
        candidatos.push(...rssCandidates);
      }
    } catch {
      // ignore RSS fallback errors
    }
  }

  const links = new Set<string>();
  const hrefRe = /href=["']([^"']{10,})["']/gi;
  let m: RegExpExecArray | null;

  while ((m = hrefRe.exec(html)) !== null) {
    let href = m[1].trim();
    if (href.startsWith("#") || href.startsWith("javascript") || href.startsWith("mailto")) continue;
    try {
      if (!href.startsWith("http")) href = new URL(href, base).href;
      const u = new URL(href);
      // same domain, path > 1 segment, not a static asset or category root
      if (
        u.hostname === base.hostname &&
        u.pathname.split("/").filter(Boolean).length >= 1 &&
        isLikelyArticleUrl(href) &&
        !/\.(css|js|png|jpg|jpeg|gif|svg|ico|pdf|mp4|webp)(\?.*)?$/i.test(u.pathname)
      ) {
        links.add(href.split("?")[0].split("#")[0]);
      }
    } catch {
      // skip
    }
  }

  candidatos.push(
    ...[...links].map((url) => ({
      url,
      fonte_id: fonte.id,
      fonte_nome: fonte.nome,
    }))
  );

  const uniq = new Map<string, Candidato>();
  for (const c of candidatos) {
    if (!uniq.has(c.url)) uniq.set(c.url, c);
  }
  return [...uniq.values()];
}

// ─── Concurrency limiter ──────────────────────────────────────────────────────

async function runConcurrent<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let i = 0;

  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      try {
        results[idx] = { status: "fulfilled", value: await tasks[idx]() };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = await req.json();
    const cidade_id: string = body.cidade_id;
    const max_articles: number = body.max_articles ?? MAX_ARTICLES_DEFAULT;
    const lookback_days: number = body.lookback_days ?? LOOKBACK_DAYS_DEFAULT;

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

    const logs: string[] = [];

    // ── 1. Carregar nome da cidade ────────────────────────────────────────────
    const { data: cidadeRow, error: cidadeErr } = await supabase
      .from("cidade")
      .select("id, nome, slug")
      .eq("id", cidade_id)
      .maybeSingle();

    if (cidadeErr) throw cidadeErr;
    if (!cidadeRow) {
      return new Response(
        JSON.stringify({ ok: false, error: "Cidade não encontrada" }),
        { status: 404, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    logs.push(`Cidade: "${cidadeRow.nome}"`);

    const { data: cidadesRef, error: cidadesRefErr } = await supabase
      .from("cidade")
      .select("id, nome, slug");
    if (cidadesRefErr) throw cidadesRefErr;
    const otherCityPhrases = listOtherCityPhrases((cidadesRef ?? []) as CidadeRef[], cidade_id);

    // ── 2. Carregar fontes dinâmicas ─────────────────────────────────────────
    const { data: fontes, error: fontesErr } = await supabase
      .from("cidade_scraping_fonte_v2")
      .select("id, nome, url, tipo")
      .eq("cidade_id", cidade_id)
      .eq("ativo", true)
      .order("ordem");

    if (fontesErr) throw fontesErr;
    if (!fontes?.length) {
      return new Response(
        JSON.stringify({ ok: true, inseridos: 0, mensagem: "Nenhuma fonte ativa para esta cidade" }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    logs.push(`Fontes ativas: ${fontes.length}`);
    const sourceHostAllowlist = buildSourceHostAllowlist(fontes as FonteRow[]);

    // ── 3. Coletar candidatos de todas as fontes ──────────────────────────────
    const todosOsCandidatos: Candidato[] = [];

    await Promise.allSettled(
      (fontes as FonteRow[]).map(async (fonte) => {
        try {
          const tipo = fonte.tipo === "auto"
            ? (/rss|feed|\.xml|atom/i.test(fonte.url) ? "rss" : "html")
            : fonte.tipo;

          const c = tipo === "rss"
            ? await coletarRSS(fonte)
            : await coletarHTML(fonte);

          logs.push(`[${fonte.nome}] ${c.length} candidatos`);
          todosOsCandidatos.push(...c);
        } catch (e) {
          logs.push(`[${fonte.nome}] ERRO na coleta: ${String(e)}`);
        }
      })
    );

    // ── 4. Deduplicar por URL ─────────────────────────────────────────────────
    const seen = new Set<string>();
    const unicos = todosOsCandidatos.filter((c) => {
      if (seen.has(c.url)) return false;
      seen.add(c.url);
      return true;
    });

    // ── 5. Filtrar por lookback (se tiver data no RSS) ────────────────────────
    const minDate = new Date(Date.now() - lookback_days * 86_400_000)
      .toISOString()
      .slice(0, 10);

    const filtrados = unicos.filter((c) =>
      !c.data_publicacao || c.data_publicacao >= minDate
    );

    logs.push(`Candidatos únicos: ${unicos.length} → após filtro de data: ${filtrados.length}`);

    // ── 6. Enriquecer artigos com fetch individual ────────────────────────────
    const tasks = filtrados.map(
      (c) => () => enrichArtigo(c, cidade_id)
    );
    const enrichResults = await runConcurrent(tasks, CONCURRENCY);

    const artigosQualificados: ArtigoFinal[] = enrichResults
      .filter((r): r is PromiseFulfilledResult<ArtigoFinal> => r.status === "fulfilled")
      .map((r) => r.value)
      .filter((a) =>
        a.titulo &&
        a.lista_imagens.length > 0 &&
        a.descricao && a.descricao.length > 50
      );

    const artigos = artigosQualificados.filter((a) =>
      isRelevantToCidade(
        a,
        cidadeRow.nome,
        cidadeRow.slug ?? null,
        otherCityPhrases,
        sourceHostAllowlist
      ).ok
    ).slice(0, max_articles);

    logs.push(`Artigos com título + imagem + descrição: ${artigosQualificados.length}`);
    logs.push(`Artigos após filtro de cidade: ${artigos.length}`);

    // ── 7. UPSERT no banco ────────────────────────────────────────────────────
    const { data: existentes, error: existentesErr } = await supabase
      .from("tabela_agente_buscador")
      .select("url")
      .eq("cidade_id", cidade_id);
    if (existentesErr) throw existentesErr;

    const existingUrls = new Set(
      (existentes ?? [])
        .map((r) => String((r as { url?: string }).url ?? "").trim())
        .filter(Boolean)
    );

    const artigosNovos = artigos.filter((a) => !existingUrls.has(a.url));
    const puladosPorJaExistir = artigos.length - artigosNovos.length;
    logs.push(`Ja existentes (mesmo link): ${puladosPorJaExistir}`);

    let inseridos = 0;
    const BATCH = 20;
    for (let i = 0; i < artigosNovos.length; i += BATCH) {
      const slice = artigosNovos.slice(i, i + BATCH);
      const { error: upsertErr, count } = await supabase
        .from("tabela_agente_buscador")
        .upsert(slice, { onConflict: "cidade_id,url", ignoreDuplicates: true })
        .select("id", { count: "exact", head: true });

      if (upsertErr) {
        logs.push(`Erro no upsert batch ${i}: ${upsertErr.message}`);
      } else {
        inseridos += count ?? slice.length;
      }
    }

    logs.push(`Novos inseridos: ${inseridos}`);

    return new Response(
      JSON.stringify({ ok: true, inseridos, total_candidatos: unicos.length, logs }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});

