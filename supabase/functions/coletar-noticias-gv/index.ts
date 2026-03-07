import { createClient } from "jsr:@supabase/supabase-js@2";

// ─── Config ───────────────────────────────────────────────────────────────────

const CIDADE_ID = "2bafc0da-6960-403b-b25b-79f72066775a";
const CONCURRENCY = 5;
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
  "Accept-Encoding": "gzip, deflate, br",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

const FONTES = [
  // localGV = true → jornal exclusivo de GV, dispensa checar "valadares" no texto
  { nome: "G1 Vales",           tipo: "rss"  as const, url: "https://g1.globo.com/dynamo/minas-gerais/vales-mg/rss2.xml",         localGV: false },
  { nome: "Diário do Rio Doce",  tipo: "html" as const, url: "https://drd.com.br/",                                                 localGV: true  },
  { nome: "Jornal da Cidade",    tipo: "html" as const, url: "https://jornaldacidadevalesdeminas.com/",                             localGV: true  },
  { nome: "DeFato Online",       tipo: "html" as const, url: "https://defatoonline.com.br/localidades/governador-valadares/",       localGV: false },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Candidate {
  url: string;
  fonte: string;
  localGV: boolean;   // true = fonte exclusiva de GV, dispensa filtro de relevância
  rssTitle?: string;
  rssDesc?: string;
  rssImage?: string;
  rssDate?: string;
}

interface Stats {
  data_processada: string;
  modo: string;
  inseridas: number;
  antigas_rejeitadas: number;
  duplicadas_url: number;
  duplicadas_titulo: number;
  sem_imagens_validas: number;
  urls_invalidas: number;
  sem_conteudo: number;
  erros: string[];
  debug?: Array<{ url: string; titulo?: string; motivo: string }>;
}

type LogFn = (msg: string, kind?: "info" | "ok" | "warn" | "err") => void;

// ─── Fetch Utilities ──────────────────────────────────────────────────────────

async function fetchSafe(
  url: string,
  opts: RequestInit = {},
  timeoutMs = 15_000,
): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...opts,
      signal: ctrl.signal,
      headers: { ...BROWSER_HEADERS, ...opts.headers },
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Date ─────────────────────────────────────────────────────────────────────

function todayBRT(): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Data mínima aceita: hoje - N dias (BRT)
function minDateBRT(days: number): string {
  return new Date(Date.now() - 3 * 60 * 60 * 1000 - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// ─── HTML Utilities ───────────────────────────────────────────────────────────

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
    .replace(/\s*[-|–]\s*(Diário do Rio Doce|G1 Vales|G1|Jornal da Cidade|DeFato Online|Globo\.com|Portal)[^$]*/i, "")
    .trim();
}

function getTitle(html: string): string {
  const og = getMeta(html, "og:title");
  if (og) return cleanTitle(og);
  const h1 = html.match(/<h1[^>]*>\s*(?:<[^>]+>)*([^<]{5,200}?)(?:<[^>]+>)*\s*<\/h1>/i);
  if (h1?.[1]) return cleanTitle(h1[1]);
  const title = html.match(/<title[^>]*>([^<]{5,300})<\/title>/i);
  if (title?.[1]) return cleanTitle(title[1]);
  return "";
}

function getOgDesc(html: string): string {
  return getMeta(html, "og:description") || getMeta(html, "description");
}

function getPublishedDate(html: string): string {
  const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const s of scripts) {
    try {
      const parsed = JSON.parse(s.replace(/<[^>]+>/g, ""));
      const items: unknown[] = Array.isArray(parsed["@graph"]) ? parsed["@graph"] : [parsed];
      for (const item of items) {
        const d = (item as Record<string, string>)["datePublished"];
        if (d) return d.slice(0, 10);
      }
    } catch { /* ignore */ }
  }
  const pub = getMeta(html, "article:published_time") || getMeta(html, "datePublished");
  if (pub) return pub.slice(0, 10);
  const time = html.match(/<time[^>]+datetime=["'](\d{4}-\d{2}-\d{2}[^"']*)["']/i);
  if (time?.[1]) return time[1].slice(0, 10);
  return "";
}

// Bloqueia URLs de imagens que claramente são ícones/logos sociais
const BLOCKED_IMG_RE = /(\/logo[s]?\/|\/icon[s]?\/|\/favicon|avatar|whatsapp|telegram|instagram|facebook|twitter|tiktok|youtube|linkedin|pinterest|pixel|tracking|badge|social[-_]|share[-_]|\/ads\/|advertisement|placeholder|default[-_]img|spinner|loading|banner[-_]lateral|widget)/i;
const BLOCKED_IMG_EXT_RE = /\.(gif|svg|ico)(\?.*)?$/i;

function getImages(html: string): string[] {
  const seen = new Set<string>();
  const imgs: string[] = [];

  const canAdd = (url: string): boolean => {
    if (!url?.startsWith("http")) return false;
    if (BLOCKED_IMG_RE.test(url)) return false;
    if (BLOCKED_IMG_EXT_RE.test(url)) return false;
    if (seen.has(url)) return false;
    return true;
  };
  const add = (url: string) => { if (canAdd(url)) { seen.add(url); imgs.push(url); } };

  // Prioridade máxima: og:image e twitter:image — imagem oficial do artigo
  const ogImg = getMeta(html, "og:image");
  const twImg = getMeta(html, "twitter:image");
  add(ogImg);
  if (twImg !== ogImg) add(twImg);

  // Se temos og:image, retorna apenas ela — é a imagem canônica da notícia
  if (imgs.length > 0) return imgs.slice(0, 1);

  // Fallback: busca APENAS dentro do corpo do artigo
  let bodyHtml = html.replace(/<(script|style|noscript|nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  for (const re of [
    /<article[^>]*>([\s\S]{200,}?)<\/article>/i,
    /class=["'][^"']*(?:entry-content|post-content|article-body|materia-texto|corpo-texto|td-post-content)[^"']*["'][^>]*>([\s\S]{200,})/i,
    /itemprop=["']articleBody["'][^>]*>([\s\S]{200,})/i,
  ]) {
    const m = bodyHtml.match(re);
    if (m?.[1]) { bodyHtml = m[1]; break; }
  }

  // Extrai <img> com validação rigorosa de dimensão, classe e alt
  const imgRe = /<img([^>]+)>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(bodyHtml)) !== null) {
    const tag = m[1];

    // Extrai src ou data-src (lazy load)
    const src = (tag.match(/\ssrc=["']([^"']+)["']/) || tag.match(/\sdata-src=["']([^"']+)["']/))?.[1] ?? "";
    if (!src) continue;

    // Bloqueia por class ou alt
    const cls = tag.match(/\sclass=["']([^"']*)["']/)?.[1] ?? "";
    const alt = tag.match(/\salt=["']([^"']*)["']/)?.[1] ?? "";
    if (BLOCKED_IMG_RE.test(cls) || BLOCKED_IMG_RE.test(alt)) continue;

    // Exige largura mínima de 300px se definida
    const w = parseInt(tag.match(/\swidth=["'](\d+)["']/)?.[1] ?? "9999");
    const h = parseInt(tag.match(/\sheight=["'](\d+)["']/)?.[1] ?? "9999");
    if (w < 300 || h < 100) continue;

    add(src);
    if (imgs.length >= 2) break;
  }

  return imgs.slice(0, 2);
}

function getBody(html: string): string {
  let text = html.replace(/<(script|style|noscript|nav|header|footer|aside|figure)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  for (const re of [
    /class=["'][^"']*(?:entry-content|post-content|article-body|materia-texto|corpo-texto|td-post-content|single-content|conteudo)[^"']*["'][^>]*>([\s\S]{100,4000})/i,
    /itemprop=["']articleBody["'][^>]*>([\s\S]{100,4000})/i,
    /<article[^>]*>([\s\S]{100,4000})/i,
    /<main[^>]*>([\s\S]{100,4000})/i,
  ]) {
    const m = text.match(re);
    if (m?.[1]) { text = m[1]; break; }
  }
  return text.replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim().slice(0, 8000);
}

// ─── RSS Parser ───────────────────────────────────────────────────────────────

function parseRSS(xml: string): Candidate[] {
  const items: Candidate[] = [];

  // Remove CDATA wrappers para simplificar o parsing
  const cleanXml = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

  // Suporta RSS 2.0 (<item> com ou sem atributos) e Atom (<entry>)
  const blocks = cleanXml.match(/<item[\s>][\s\S]*?<\/item>/gi)
    ?? cleanXml.match(/<entry[\s>][\s\S]*?<\/entry>/gi)
    ?? [];

  for (const block of blocks) {
    const getText = (tag: string) =>
      block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]?.trim() ?? "";

    // Estratégias para URL em ordem de prioridade
    let url = "";
    // 1. <link>https://...</link>
    const m1 = block.match(/<link[^>]*>(https?:\/\/[^<\s]+)<\/link>/i);
    if (m1) url = m1[1].trim();
    // 2. <link/> vazio seguido de URL (RSS 1.0)
    if (!url) {
      const m2 = block.match(/<link\s*\/?>\s*(https?:\/\/[^\s<]+)/i);
      if (m2) url = m2[1].trim();
    }
    // 3. Atom: <link href="..." rel="alternate"> ou <link href="...">
    if (!url) {
      const m3 = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*(?:rel=["']alternate["'][^>]*)?\/>/i)
        ?? block.match(/<link[^>]+(?:rel=["']alternate["'][^>]+)?href=["']([^"']+)["']/i);
      if (m3) url = m3[1].trim();
    }
    // 4. <guid isPermaLink="true"> ou <guid> com URL
    if (!url) {
      const g = getText("guid");
      if (g.startsWith("http")) url = g.trim();
    }

    const title   = decodeEntities(getText("title").replace(/<[^>]+>/g, "").trim());
    const desc    = decodeEntities((getText("summary") || getText("description")).replace(/<[^>]+>/g, "").trim());
    const image   =
      block.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1] ||
      block.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1] ||
      block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1] || "";
    const pubDate = getText("pubDate") || getText("published") || getText("updated") || getText("dc:date");

    let date = "";
    if (pubDate) { try { date = new Date(pubDate).toISOString().slice(0, 10); } catch { /* ignore */ } }

    if (url && isValidUrl(url)) {
      items.push({ url, fonte: "", localGV: false, rssTitle: title, rssDesc: desc, rssImage: image || undefined, rssDate: date || undefined });
    }
  }
  return items;
}

// ─── URL / Text Filters ───────────────────────────────────────────────────────

const BLOCKED_EXTS_RE  = /\.(png|jpe?g|gif|webp|svg|ico|js|css|pdf|mp4|mp3|zip|rar|exe|xml|json|woff2?|ttf|eot)(\?.*)?$/i;
const BLOCKED_SEGS_RE  = /\/(feed|rss|category|categoria|tag|wp-admin|wp-content|wp-includes|wp-json|wp-login\.php|author|autor|search|busca|pagina|page)(?:\/|$)/i;
const BLOCKED_TITLE_RE = /\b(arquivo|arquivos|feed|rss|404|edital|expediente|anuncie|publicidade)\b/i;
const OTHER_CITIES_RE  = /\b(itabira|ipatinga|belo horizonte|caratinga|coronel fabriciano|timoteo|timóteo|manhuacu|manhuaçu|inhapim|muriae|muriaé|ubai|ubaí)\b/i;
const GV_RE            = /\b(governador valadares|valadares)\b/i;
const PERSON_NAME_RE   = /^[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][a-záéíóúãõâêîôûàèìòùç]+(?: [A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][a-záéíóúãõâêîôûàèìòùç]+){1,2}$/;

function isValidUrl(url: string): boolean {
  if (!url.startsWith("http")) return false;
  if (BLOCKED_EXTS_RE.test(url) || BLOCKED_SEGS_RE.test(url) || url.includes("#")) return false;
  return true;
}

function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function jaccard(a: string, b: string): number {
  const words = (s: string) => new Set(norm(s).split(/\W+/).filter(w => w.length > 3));
  const wa = words(a), wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

function inferCategory(text: string): string {
  const t = norm(text);
  if (/polici|crimin|preso|apreend|trafic|homicid|assalt|roubo|furto|delegaci|investigac|operacao/.test(t)) return "policia";
  if (/acidente|batida|colisao|capotou|atropel|caminhao|transito|carreta|tombou/.test(t))                   return "acidente";
  if (/prefeit|vereador|deputado|senador|eleicao|mandato|camara|municipal|politico/.test(t))                 return "politica";
  if (/saude|hospital|ubs|medico|doenca|vacina|dengue|covid|cancer|enfermari|sus/.test(t))                   return "saude";
  if (/escola|educacao|universidade|faculdade|aluno|professor|ensino|formatura/.test(t))                     return "educacao";
  if (/esporte|futebol|atletico|cruzeiro|campeonato|jogo|time|gol|olimp/.test(t))                           return "esporte";
  if (/economia|emprego|empresa|comercio|industria|produto|preco|financ|negocio/.test(t))                   return "economia";
  return "geral";
}

// ─── Claude Haiku ─────────────────────────────────────────────────────────────

async function rewriteWithClaude(fonte: string, titulo: string, ogDesc: string, bodyContext: string, apiKey: string): Promise<{ titulo: string; descricao: string } | null> {
  const resp = await fetchSafe("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: `Você é editor de jornal. Com base no resumo oficial do artigo, escreva uma matéria jornalística completa em português brasileiro. NÃO invente fatos. Use APENAS as informações fornecidas.\n\nFonte: ${fonte}\nTítulo original: ${titulo}\nResumo oficial do artigo: ${ogDesc}\nContexto adicional (pode conter ruído): ${bodyContext.slice(0, 800)}\n\nResponda SOMENTE com JSON válido:\n{"titulo": "...", "descricao": "..."}\n\nRegras:\n- Título: máximo 100 caracteres, objetivo e impactante, sem nome do jornal\n- Descrição: 3 a 5 parágrafos separados por \\n\\n, linguagem jornalística clara, elabore os fatos sem inventar` }],
    }),
  }, 30_000);
  if (!resp?.ok) return null;
  try {
    const data = await resp.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const match = text.match(/\{[\s\S]*?"titulo"[\s\S]*?"descricao"[\s\S]*?\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.titulo === "string" && typeof parsed.descricao === "string")
      return { titulo: parsed.titulo.slice(0, 100), descricao: parsed.descricao };
  } catch { /* ignore */ }
  return null;
}

// ─── Image Validation ─────────────────────────────────────────────────────────

async function validateImage(url: string): Promise<boolean> {
  if (BLOCKED_IMG_RE.test(url) || BLOCKED_IMG_EXT_RE.test(url)) return false;
  const resp = await fetchSafe(url, { method: "HEAD" }, 5_000);
  if (!resp?.ok) return false;
  const ct = resp.headers.get("content-type") ?? "";
  if (!ct.startsWith("image/") || ct.includes("svg") || ct.includes("gif")) return false;
  // Ícones sociais e favicons são geralmente < 5 KB; fotos de notícias têm ao menos 10 KB
  const size = parseInt(resp.headers.get("content-length") ?? "0");
  if (size > 0 && size < 10_000) return false;
  return true;
}

// ─── Homepage Link Extraction ─────────────────────────────────────────────────

function extractArticleLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const seen = new Set<string>();
  const links: string[] = [];
  const re = /href=["']([^"']{5,300})["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    try {
      const url = new URL(m[1], baseUrl).href;
      if (!url.startsWith(base.origin) || !isValidUrl(url)) continue;
      const path = new URL(url).pathname;
      if (path === "/" || path.split("/").filter(Boolean).length < 1) continue;
      if (!seen.has(url)) { seen.add(url); links.push(url); }
    } catch { /* ignore */ }
  }
  return links;
}

// ─── Core Scraping Logic ──────────────────────────────────────────────────────

async function runScraping(opts: {
  testMode: boolean;
  debugMode: boolean;
  anthropicKey: string;
  log: LogFn;
  // deno-lint-ignore no-explicit-any
  supabase: any;
}): Promise<Stats> {
  const { testMode, debugMode, anthropicKey, log, supabase } = opts;
  const today   = todayBRT();
  const minDate = minDateBRT(3); // aceita artigos dos últimos 4 dias (hoje + 3 anteriores)

  const stats: Stats = {
    data_processada: today.split("-").reverse().join("/"),
    modo: testMode ? "TESTE" : anthropicKey ? "NORMAL + IA" : "NORMAL",
    inseridas: 0,
    antigas_rejeitadas: 0,
    duplicadas_url: 0,
    duplicadas_titulo: 0,
    sem_imagens_validas: 0,
    urls_invalidas: 0,
    sem_conteudo: 0,
    erros: [],
    ...(debugMode ? { debug: [] } : {}),
  };

  function reject(url: string, titulo: string | undefined, motivo: string) {
    if (debugMode) stats.debug!.push({ url, titulo, motivo });
  }

  // Load existing for dedup
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: existing } = await supabase
    .from("rel_cidade_jornal")
    .select("id_externo, titulo")
    .eq("cidade_id", CIDADE_ID)
    .gte("created_at", sevenDaysAgo);

  const existingUrls  = new Set<string>((existing ?? []).map((r: { id_externo: string }) => r.id_externo).filter(Boolean));
  const existingTitles: string[] = (existing ?? []).map((r: { titulo: string }) => r.titulo).filter(Boolean);

  // ── Step 1: Collect candidates ─────────────────────────────────────────────
  const candidates: Candidate[] = [];

  await Promise.all(FONTES.map(async (fonte) => {
    log(`🔍 Coletando links: ${fonte.nome}...`);
    const resp = await fetchSafe(fonte.url, {}, 20_000);
    if (!resp?.ok) {
      stats.erros.push(`${fonte.nome}: HTTP ${resp?.status ?? "timeout"}`);
      log(`❌ ${fonte.nome}: falha (${resp?.status ?? "timeout"})`, "err");
      return;
    }
    const text = await resp.text();
    const found: Candidate[] = [];
    if (fonte.tipo === "rss") {
      const parsed = parseRSS(text);
      if (parsed.length === 0) {
        // Debug: mostra primeiros 300 chars do XML para diagnóstico
        log(`  🔎 G1 RSS preview: ${text.slice(0, 300).replace(/\s+/g, " ")}`, "warn");
      }
      for (const item of parsed) found.push({ ...item, fonte: fonte.nome, localGV: fonte.localGV });
    } else {
      for (const link of extractArticleLinks(text, fonte.url)) found.push({ url: link, fonte: fonte.nome, localGV: fonte.localGV });
    }
    log(`✅ ${fonte.nome}: ${found.length} links encontrados`, "ok");
    candidates.push(...found);
  }));

  // Deduplicate
  const seenCandidates = new Set<string>();
  const unique = candidates.filter(c => { if (seenCandidates.has(c.url)) return false; seenCandidates.add(c.url); return true; });
  log(`📊 Total: ${candidates.length} candidatos | ${unique.length} únicos após dedup`);

  // ── Step 2: Pre-filter ────────────────────────────────────────────────────
  const toProcess: Candidate[] = [];
  for (const c of unique) {
    if (!isValidUrl(c.url)) { stats.urls_invalidas++; reject(c.url, c.rssTitle, "URL inválida"); continue; }
    if (existingUrls.has(c.url)) { stats.duplicadas_url++; reject(c.url, c.rssTitle, "URL duplicada"); continue; }
    if (!testMode && c.rssDate && c.rssDate < minDate) { stats.antigas_rejeitadas++; reject(c.url, c.rssTitle, `Data antiga: ${c.rssDate}`); continue; }
    toProcess.push(c);
  }
  log(`⚙️  Processando ${toProcess.length} artigos...`);

  // ── Step 3: Process each article ──────────────────────────────────────────
  async function processArticle(candidate: Candidate): Promise<void> {
    const { url, fonte, localGV, rssTitle, rssDesc, rssImage, rssDate } = candidate;

    const resp = await fetchSafe(url, {}, 15_000);
    if (!resp?.ok) {
      stats.erros.push(`${url}: HTTP ${resp?.status ?? "timeout"}`);
      log(`  ⚠️  ${url.slice(-60)}: HTTP ${resp?.status ?? "timeout"}`, "warn");
      return;
    }
    const html = await resp.text();

    const titulo  = getTitle(html)  || rssTitle || "";
    const ogDesc  = getOgDesc(html) || rssDesc  || "";
    const body    = getBody(html);
    const pubDate = getPublishedDate(html) || rssDate || "";
    const short   = titulo.length > 55 ? titulo.slice(0, 55) + "…" : titulo;

    // Filters
    if (titulo.length < 15)                    { stats.urls_invalidas++;     reject(url, titulo, "Título muito curto");          log(`  ✗ [curto] ${short}`, "warn"); return; }
    if (BLOCKED_TITLE_RE.test(titulo))         { stats.urls_invalidas++;     reject(url, titulo, "Palavra bloqueada no título");  log(`  ✗ [bloqueado] ${short}`, "warn"); return; }
    if (PERSON_NAME_RE.test(titulo.trim()))    { stats.urls_invalidas++;     reject(url, titulo, "Parece nome de pessoa");        log(`  ✗ [nome] ${short}`, "warn"); return; }
    if (OTHER_CITIES_RE.test(norm(titulo)))    { stats.urls_invalidas++;     reject(url, titulo, "Outra cidade no título");       log(`  ✗ [outra cidade] ${short}`, "warn"); return; }
    if (!testMode && pubDate && pubDate < minDate) { stats.antigas_rejeitadas++; reject(url, titulo, `Data antiga: ${pubDate}`); log(`  ✗ [antiga ${pubDate}] ${short}`, "warn"); return; }
    if (ogDesc.length < 60 && body.length < 100)  { stats.sem_conteudo++;   reject(url, titulo, "Conteúdo insuficiente");        log(`  ✗ [sem conteúdo] ${short}`, "warn"); return; }

    // Jornais exclusivamente de GV (DRD, Jornal da Cidade) não precisam mencionar "Valadares"
    if (!localGV) {
      const relevanceText = norm(`${titulo} ${ogDesc} ${body.slice(0, 200)}`);
      if (!GV_RE.test(relevanceText))          { stats.urls_invalidas++;     reject(url, titulo, "Não menciona Valadares");       log(`  ✗ [irrelevante] ${short}`, "warn"); return; }
    }

    if (existingTitles.some(t => jaccard(t, titulo) > 0.8)) {
      stats.duplicadas_titulo++;
      reject(url, titulo, "Título duplicado (Jaccard > 0.8)");
      log(`  ✗ [dup título] ${short}`, "warn");
      return;
    }

    // Images
    const rawImages = getImages(html);
    if (rssImage && !rawImages.includes(rssImage)) rawImages.unshift(rssImage);
    const validImages: string[] = [];
    for (const img of rawImages.slice(0, 6)) {
      if (await validateImage(img)) { validImages.push(img); if (validImages.length >= 3) break; }
    }
    if (validImages.length === 0) { stats.sem_imagens_validas++; reject(url, titulo, "Sem imagens válidas"); log(`  ✗ [sem imagem] ${short}`, "warn"); return; }

    // Rewrite or fallback
    let finalTitulo    = titulo;
    // Sem IA: usa o corpo completo do artigo como descrição (até 8000 chars)
    let finalDescricao = body.length >= 200 ? body : ogDesc;
    if (anthropicKey && ogDesc.length >= 60) {
      log(`  🤖 Reescrevendo com IA: ${short}`);
      const rewritten = await rewriteWithClaude(fonte, titulo, ogDesc, body, anthropicKey);
      if (rewritten) { finalTitulo = rewritten.titulo; finalDescricao = rewritten.descricao; }
    }

    const { error } = await supabase.from("rel_cidade_jornal").insert({
      cidade_id: CIDADE_ID,
      titulo: finalTitulo,
      descricao: finalDescricao,
      descricao_curta: ogDesc.slice(0, 300) || body.slice(0, 300),
      fonte,
      imagens: validImages,
      id_externo: url,
      categoria: inferCategory(`${finalTitulo} ${finalDescricao}`),
    });

    if (error) {
      stats.erros.push(`insert(${url.slice(-50)}): ${error.message}`);
      log(`  ✗ [db error] ${short}`, "err");
    } else {
      stats.inseridas++;
      existingUrls.add(url);
      existingTitles.push(finalTitulo);
      log(`  ✓ Inserido: ${short}`, "ok");
    }
  }

  for (let i = 0; i < toProcess.length; i += CONCURRENCY) {
    await Promise.all(toProcess.slice(i, i + CONCURRENCY).map(processArticle));
  }

  stats.erros = stats.erros.slice(0, 20);
  log(`🏁 Concluído! ${stats.inseridas} inserida(s) | ${stats.antigas_rejeitadas} antigas | ${stats.duplicadas_url + stats.duplicadas_titulo} dup | ${stats.sem_imagens_validas} sem imagem`, "ok");
  return stats;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let params: { test_mode?: boolean; debug?: boolean; stream?: boolean } = {};
  try { params = await req.json(); } catch { /* no body */ }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  const testMode  = params.test_mode === true;
  const debugMode = params.debug    === true;
  const streamMode = params.stream  === true;

  // ── Streaming mode (SSE) ───────────────────────────────────────────────────
  if (streamMode) {
    const enc = new TextEncoder();
    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    const send = (data: object) => {
      writer.write(enc.encode(`data: ${JSON.stringify(data)}\n\n`)).catch(() => {});
    };

    const log: LogFn = (msg, kind = "info") => send({ type: "log", msg, kind });

    (async () => {
      try {
        const stats = await runScraping({ testMode, debugMode, anthropicKey, log, supabase });
        send({ type: "done", ...stats });
      } catch (e) {
        send({ type: "error", msg: String(e) });
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", ...CORS },
    });
  }

  // ── Normal mode (JSON, used by pg_cron) ────────────────────────────────────
  try {
    const stats = await runScraping({
      testMode,
      debugMode,
      anthropicKey,
      log: () => {},
      supabase,
    });
    return new Response(JSON.stringify(stats, null, 2), {
      status: 200,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...CORS },
    });
  }
});
