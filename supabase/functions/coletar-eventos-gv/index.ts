import { createClient } from "jsr:@supabase/supabase-js@2";

const DEFAULT_CIDADE_ID = "2bafc0da-6960-403b-b25b-79f72066775a";
const MAX_EVENTS_DEFAULT = 40;
const LOOKBACK_DAYS_DEFAULT = 20;
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
  "Cache-Control": "no-cache",
};

type LogFn = (msg: string, kind?: "info" | "ok" | "warn" | "err") => void;

interface FonteEvento {
  nome: string;
  tipo: "html" | "rss";
  url: string;
}

interface Candidate {
  url: string;
  fonte: string;
}

interface RawSignals {
  titleCandidates: string[];
  dateCandidates: string[];
  timeCandidates: string[];
  locationCandidates: string[];
  imageCandidates: string[];
  ticketCandidates: string[];
  textExcerpt: string;
}

interface Stats {
  data_processada: string;
  inseridos: number;
  antigas_rejeitadas: number;
  duplicados: number;
  sem_imagem: number;
  sem_data: number;
  urls_invalidas: number;
  erros: string[];
}

const DEFAULT_FONTES: FonteEvento[] = [
  { nome: "Sympla GV", tipo: "html", url: "https://www.sympla.com.br/eventos/governador-valadares-mg" },
  { nome: "Ingresso.com", tipo: "html", url: "https://www.ingresso.com/" },
  { nome: "G1 Vales", tipo: "html", url: "https://g1.globo.com/mg/vales-mg/" },
  { nome: "DRD Cultura", tipo: "html", url: "https://drd.com.br/" },
];

const EVENT_KEYWORDS_RE = /(evento|eventos|show|shows|teatro|stand-?up|comedia|comédia|musica|música|festival|espet[aá]culo|agenda|programa[cç][aã]o)/i;
const GV_RE = /governador[\s-]+valadares/i;
const TICKET_HOST_RE = /(sympla|eventbrite|ingresso\.com|blueticket|bilheteriadigital)/i;
const BLOCKED_LINK_RE = /(\/blog|\/help|\/ajuda|\/about|\/sobre|\/contato|\/login|\/signup|\/cadastro|\/termos|\/privacy|\/politica|\/cookies|\/api|\/status|\/carreiras|\/careers)/i;
const NON_EVENT_URL_RE = /(proximos-jogos|times\/|\/tabela|\/ao-vivo|\/ge\/|\/globoplay\/|\/noticia\/|\/news\/)/i;
const INSTITUTIONAL_URL_RE = /(\/solicitacoes-eventos\/|\/atendimento|\/fale-conosco|\/institucional|\/quem-somos|\/politica|\/termos|\/privacy|\/cancelar|\/consultar-ingressos)/i;
const MONTHS_PT: Record<string, string> = {
  janeiro: "01",
  jan: "01",
  fevereiro: "02",
  fev: "02",
  marco: "03",
  "março": "03",
  mar: "03",
  abril: "04",
  abr: "04",
  maio: "05",
  mai: "05",
  junho: "06",
  jun: "06",
  julho: "07",
  jul: "07",
  agosto: "08",
  ago: "08",
  setembro: "09",
  set: "09",
  outubro: "10",
  out: "10",
  novembro: "11",
  nov: "11",
  dezembro: "12",
  dez: "12",
};

function isEventDetailUrl(url: string, sourceName: string): boolean {
  const u = url.toLowerCase();
  const src = sourceName.toLowerCase();
  if (src.includes("sympla")) return /sympla\.com\.br\/evento\/[^/]+\/\d+/.test(u);
  if (src.includes("eventbrite")) return /eventbrite\..+\/e\/.+-tickets-\d+/.test(u);
  if (src.includes("ingresso")) return /ingresso\.com\/(?:evento|espetaculos)\/[^/?#]{3,}/.test(u);
  if (src.includes("blueticket")) return /blueticket\..+\/evento/i.test(u);
  if (src.includes("bilheteria")) return /bilheteriadigital\..+\/(?:evento|eventos|ingressos)\//i.test(u);
  return /(evento|eventos|agenda|show|teatro|festival|stand-?up|cultura)/i.test(u) &&
    !/(\/author\/|\/categoria\/|\/tag\/|\/page\/\d+\/|\/wp-content\/)/i.test(u);
}

async function fetchSafe(url: string, opts: RequestInit = {}, timeoutMs = 15_000): Promise<Response | null> {
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

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isHttpUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

function normalizeCandidateUrl(raw: string): string {
  try {
    // Limpa escapes e sujeira comum extraida de HTML/JSON/texto
    const cleaned = decodeEntities(String(raw ?? ""))
      .replace(/\\\//g, "/")
      .replace(/\\+$/g, "")
      .replace(/[)\],;'"`]+$/g, "")
      .trim();
    const u = new URL(cleaned);
    u.hash = "";
    const drop = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"];
    for (const k of drop) u.searchParams.delete(k);
    return u.toString();
  } catch {
    return String(raw ?? "").trim();
  }
}

function sanitizeEventUrl(url: string): string {
  let out = String(url ?? "").trim();
  out = out.replace(/\\+$/g, "");
  out = out.replace(/%5C+$/gi, "");
  out = out.replace(/[)\],;'"`]+$/g, "");
  return out;
}

function inferTitleFromEventUrl(url: string): string {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/evento\/([^/]+)/i);
    if (!m?.[1]) return "";
    return decodeURIComponent(m[1])
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return "";
  }
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function getMeta(html: string, prop: string): string {
  for (const re of [
    new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']{1,1500})["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']{1,1500})["'][^>]+(?:property|name)=["']${prop}["']`, "i"),
  ]) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return "";
}

async function fetchIngressoSitemapGovValadaresLinks(log: LogFn): Promise<string[]> {
  const queue = ["https://www.ingresso.com/sitemap.xml"];
  const visitedSitemaps = new Set<string>();
  const foundLinks = new Set<string>();

  while (queue.length > 0 && visitedSitemaps.size < 50) {
    const sitemapUrl = queue.shift()!;
    if (visitedSitemaps.has(sitemapUrl)) continue;
    visitedSitemaps.add(sitemapUrl);

    const resp = await fetchSafe(sitemapUrl, {}, 20_000);
    if (!resp?.ok) continue;
    const xml = await resp.text();
    const locs = [...new Set((xml.match(/<loc>([^<]+)<\/loc>/gi) ?? []).map((x) => x.replace(/<\/?loc>/gi, "")))];

    for (const raw of locs) {
      const u = decodeEntities(raw.trim());
      if (!isHttpUrl(u)) continue;
      if (/\.xml(?:$|\?)/i.test(u) && /ingresso\.com/i.test(u)) {
        if (!visitedSitemaps.has(u)) queue.push(u);
        continue;
      }
      if (/ingresso\.com\/(?:evento|espetaculos?)\//i.test(u)) {
        foundLinks.add(normalizeCandidateUrl(u));
      }
    }
  }

  const score = (u: string): number => {
    const n = normalize(u);
    let s = 0;
    if (/governador-valadares|governador valadares|valadares/.test(n)) s += 100;
    if (/stand-?up|comedia|com[eé]dia|teatro|show|festival/.test(n)) s += 40;
    return s;
  };

  const out = [...foundLinks]
    .sort((a, b) => score(b) - score(a))
    .slice(0, 160);

  if (out.length > 0) log(`  🧭 Ingresso sitemap: ${out.length} links`, "info");
  return out;
}

async function fetchSitemapLinks(params: {
  sitemapUrl: string;
  mustContain?: RegExp;
  keywordFilter?: RegExp;
  limit?: number;
}): Promise<string[]> {
  const { sitemapUrl, mustContain, keywordFilter, limit = 120 } = params;
  const resp = await fetchSafe(sitemapUrl, {}, 20_000);
  if (!resp?.ok) return [];
  const xml = await resp.text();
  const locs = [...new Set((xml.match(/<loc>([^<]+)<\/loc>/gi) ?? []).map((x) => x.replace(/<\/?loc>/gi, "").trim()))];
  return locs
    .map((u) => decodeEntities(u))
    .filter((u) => isHttpUrl(u))
    .filter((u) => (mustContain ? mustContain.test(u) : true))
    .filter((u) => (keywordFilter ? keywordFilter.test(normalize(u)) : true))
    .slice(0, limit);
}

function getTitle(html: string): string {
  const og = getMeta(html, "og:title");
  if (og) return og.replace(/\s*[\-|–—]\s*.+$/, "").trim();
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "";
  if (h1) return decodeEntities(h1.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim());
  const title = html.match(/<title[^>]*>([^<]{3,300})<\/title>/i)?.[1] ?? "";
  return decodeEntities(title.replace(/\s*[\-|–—]\s*.+$/, "").trim());
}

function getBody(html: string): string {
  return decodeEntities(
    html
      .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).slice(0, 8000);
}

function toAbsoluteUrl(raw: string, baseUrl: string): string {
  const clean = decodeEntities(raw ?? "").trim();
  if (!clean || clean.startsWith("data:")) return "";
  try {
    return new URL(clean, baseUrl).href;
  } catch {
    return "";
  }
}

function extractLinks(html: string, baseUrl: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const re = /href=["']([^"']{5,600})["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const url = toAbsoluteUrl(m[1], baseUrl);
    if (!isHttpUrl(url)) continue;
    const norm = normalizeCandidateUrl(url);
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(norm);
  }
  return out;
}

async function searchWebCandidates(query: string, source: string): Promise<Candidate[]> {
  const url = `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const resp = await fetchSafe(url, {}, 15_000);
  if (!resp?.ok) return [];
  const html = await resp.text();
  const out: Candidate[] = [];
  const seen = new Set<string>();

  const re = /<a[^>]+href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    let href = decodeEntities(m[1]);
    const uddg = href.match(/[?&]uddg=([^&]+)/i)?.[1];
    if (uddg) href = decodeURIComponent(uddg);
    if (!isHttpUrl(href)) continue;
    const norm = normalizeCandidateUrl(href);
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push({ url: norm, fonte: source });
  }
  return out;
}

async function searchWebCandidatesBing(query: string, source: string): Promise<Candidate[]> {
  const url = `https://www.bing.com/search?q=${encodeURIComponent(query)}&setlang=pt-BR`;
  const resp = await fetchSafe(url, {}, 15_000);
  if (!resp?.ok) return [];
  const html = await resp.text();
  const out: Candidate[] = [];
  const seen = new Set<string>();
  const re = /<a[^>]+href=["'](https?:\/\/[^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = decodeEntities(m[1]);
    if (!isHttpUrl(href)) continue;
    const norm = normalizeCandidateUrl(href);
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push({ url: norm, fonte: source });
  }
  return out;
}

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return "";
  }
}

function buildSearchQueries(fonte: FonteEvento): string[] {
  const host = domainFromUrl(fonte.url);
  const nome = normalize(fonte.nome);
  const out = new Set<string>();

  if (host) {
    out.add(`site:${host} "governador valadares" evento`);
  }
  if (/ingresso/.test(nome) || /ingresso\.com/.test(host)) {
    out.add(`site:ingresso.com/evento "governador-valadares"`);
    out.add(`site:ingresso.com/evento "governador valadares" show`);
    out.add(`site:ingresso.com/evento "teatro atiaia"`);
  } else if (/sympla/.test(nome) || /sympla/.test(host)) {
    out.add(`site:sympla.com.br/evento "governador valadares"`);
    out.add(`site:sympla.com.br/evento "governador valadares mg"`);
  } else if (/eventbrite/.test(nome) || /eventbrite/.test(host)) {
    out.add(`site:eventbrite.com.br/e "governador valadares"`);
    out.add(`site:eventbrite.com.br/e "governador valadares mg"`);
  } else if (/blueticket/.test(nome) || /blueticket/.test(host)) {
    out.add(`site:blueticket.com.br evento "governador valadares"`);
  } else if (/bilheteria/.test(nome) || /bilheteriadigital/.test(host)) {
    out.add(`site:bilheteriadigital.com evento "governador valadares"`);
  } else {
    out.add(`site:${host} "governador valadares" (evento OR show OR teatro)`);
  }

  out.add(`"agenda cultural" "governador valadares" ingressos`);
  out.add(`"stand-up comedy" "governador valadares" ingressos`);

  return [...out];
}

function buildGlobalDiscoveryQueries(): string[] {
  return [
    `"festival anime" "governador valadares" 2026`,
    `"startup day" "governador valadares" 2026`,
    `"agenda cultural" "governador valadares" março 2026`,
    `"agenda cultural" "governador valadares" abril 2026`,
    `"stand-up" "governador valadares" ingressos`,
    `"teatro" "governador valadares" ingressos`,
    `"show" "governador valadares" ingressos`,
    `site:sympla.com.br/evento "governador valadares"`,
    `site:ingresso.com/evento "governador valadares"`,
    `site:eventbrite.com.br/e "governador valadares"`,
  ];
}

function buildPlatformSeedUrls(fonte: FonteEvento): string[] {
  const n = normalize(fonte.nome);
  const urls: string[] = [];
  if (/sympla/.test(n)) {
    urls.push(
      "https://www.sympla.com.br/eventos/governador-valadares-mg",
      "https://www.sympla.com.br/eventos/governador-valadares-mg?pagina=1",
      "https://www.sympla.com.br/eventos/governador-valadares-mg?pagina=2",
      "https://www.sympla.com.br/eventos/governador-valadares-mg?pagina=3",
      "https://www.sympla.com.br/eventos?search=governador%20valadares",
      "https://www.sympla.com.br/eventos?search=festival%20anime%20gv%202026",
      "https://www.sympla.com.br/eventos?search=startup%20day%20governador%20valadares",
    );
  }
  if (/eventbrite/.test(n)) {
    urls.push(
      "https://www.eventbrite.com.br/d/brazil--governador-valadares/events/",
      "https://www.eventbrite.com/d/brazil--governador-valadares/events/",
    );
  }
  if (/ingresso/.test(n)) {
    urls.push(
      "https://www.ingresso.com/eventos/governador-valadares",
      "https://www.ingresso.com/eventos/governador-valadares/home",
    );
  }
  return urls;
}

function extractLinksByFonte(html: string, fonteUrl: string, fonteNome: string): string[] {
  const baseLinks = extractLinks(html, fonteUrl);
  const htmlUnescaped = html.replace(/\\\//g, "/");
  const text = `${html}\n${htmlUnescaped}`;
  const host = (() => {
    try {
      return new URL(fonteUrl).hostname;
    } catch {
      return "";
    }
  })();

  const ingressoLike = /ingresso\.com/i.test(host) || /ingresso/i.test(fonteNome);
  if (ingressoLike) {
    const regexLinks = [
      ...new Set(
        (text.match(/https?:\/\/(?:www\.)?ingresso\.com\/evento\/[^\s"'<>]+/gi) ?? []),
      ),
    ];
    const merged = [...baseLinks, ...regexLinks];
    return merged
      .filter((u) => /ingresso\.com\/evento\//i.test(u))
      .filter((u) => !/ingresso\.com\/evento\/?$/i.test(u))
      .filter((u) => !BLOCKED_LINK_RE.test(u));
  }

  const eventbriteLike = /eventbrite/i.test(host) || /eventbrite/i.test(fonteNome);
  if (eventbriteLike) {
    const regexLinks = [
      ...new Set(
        (text.match(/https?:\/\/(?:www\.)?eventbrite\.[^\s"'<>]+\/e\/[^\s"'<>]+/gi) ?? []),
      ),
    ];
    return [...baseLinks, ...regexLinks]
      .filter((u) => /eventbrite/.test(u))
      .filter((u) => /(\/e\/|\/events\/)/i.test(u))
      .filter((u) => !BLOCKED_LINK_RE.test(u));
  }

  const symplaLike = /sympla/i.test(host) || /sympla/i.test(fonteNome);
  if (symplaLike) {
    const regexLinks = [
      ...new Set(
        (text.match(/https?:\/\/(?:www\.)?sympla\.com\.br\/evento\/[^\s"'<>]+/gi) ?? []),
      ),
    ];
    return [...baseLinks, ...regexLinks]
      .filter((u) => /sympla/.test(u))
      .filter((u) => /\/evento\//i.test(u))
      .filter((u) => !BLOCKED_LINK_RE.test(u));
  }

  const bilheteriaLike = /bilheteriadigital/i.test(host) || /bilheteria/i.test(fonteNome);
  if (bilheteriaLike) {
    const regexLinks = [
      ...new Set(
        (text.match(/https?:\/\/(?:www\.)?bilheteriadigital\.[^\s"'<>]+\/(?:evento|eventos|ingressos)\/[^\s"'<>]+/gi) ?? []),
      ),
    ];
    return [...baseLinks, ...regexLinks]
      .filter((u) => /bilheteriadigital/i.test(u))
      .filter((u) => /(evento|eventos|ingressos)/i.test(u))
      .filter((u) => !BLOCKED_LINK_RE.test(u));
  }

  const g1Like = /g1\.globo\.com/i.test(host) || /\bg1\b/i.test(fonteNome);
  if (g1Like) {
    return baseLinks
      .filter((u) => /g1\.globo\.com/i.test(u))
      .filter((u) => /(agenda|evento|eventos|show|teatro|cultura|vales-mg)/i.test(u))
      .filter((u) => !NON_EVENT_URL_RE.test(u))
      .filter((u) => !BLOCKED_LINK_RE.test(u));
  }

  return baseLinks.filter((u) => !BLOCKED_LINK_RE.test(u));
}

function isAllowedCandidateForFonte(url: string, fonte: FonteEvento): boolean {
  const host = normalize(domainFromUrl(url));
  const fonteNome = normalize(fonte.nome);
  if (/sympla/.test(fonteNome)) return /sympla\.com\.br/i.test(host);
  if (/ingresso/.test(fonteNome)) return /ingresso\.com/i.test(host);
  if (/g1/.test(fonteNome)) return /g1\.globo\.com/i.test(host);
  if (/drd/.test(fonteNome)) return /drd\.com\.br/i.test(host);
  return true;
}

function chooseBestImage(html: string, pageUrl: string): string {
  const candidates: Array<{ url: string; score: number }> = [];
  const push = (raw: string, base: number) => {
    const url = toAbsoluteUrl(raw, pageUrl);
    if (!url) return;
    const u = normalize(url);
    let score = base;
    if (/event-covers|banner|flyer|cartaz|poster|cover|hero/.test(u)) score += 80;
    if (/thumb|thumbnail|avatar|icon|logo|marca/.test(u)) score -= 120;
    candidates.push({ url, score });
  };

  const og = getMeta(html, "og:image");
  if (og) push(og, 160);
  const tw = getMeta(html, "twitter:image");
  if (tw) push(tw, 140);

  const re = /<img([^>]+)>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[1];
    const src = tag.match(/\s(?:src|data-src|data-original)=["']([^"']+)["']/i)?.[1] ?? "";
    if (!src) continue;
    const w = Number(tag.match(/\swidth=["']?(\d{2,5})["']?/i)?.[1] ?? "0");
    const h = Number(tag.match(/\sheight=["']?(\d{2,5})["']?/i)?.[1] ?? "0");
    const areaScore = Math.min(120, Math.floor((w * h) / 8000));
    push(src, 30 + areaScore + (w >= 300 || h >= 300 ? 20 : 0));
  }

  // fallback para flyers em CSS inline/background
  const bgMatches = html.match(/background(?:-image)?\s*:\s*url\(([^)]+)\)/gi) ?? [];
  for (const b of bgMatches.slice(0, 20)) {
    const raw = b.match(/url\(([^)]+)\)/i)?.[1]?.replace(/^["']|["']$/g, "") ?? "";
    if (raw) push(raw, 95);
  }

  const cssUrlMatches = html.match(/url\((https?:\/\/[^)'" ]+)\)/gi) ?? [];
  for (const c of cssUrlMatches.slice(0, 20)) {
    const raw = c.match(/url\((https?:\/\/[^)'" ]+)\)/i)?.[1] ?? "";
    if (raw) push(raw, 70);
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url ?? "";
}

async function validateImage(url: string): Promise<boolean> {
  if (!url || !isHttpUrl(url)) return false;
  const head = await fetchSafe(url, { method: "HEAD" }, 6_000);
  if (head?.ok) {
    const ct = head.headers.get("content-type") ?? "";
    if (ct.startsWith("image/")) return true;
  }
  const get = await fetchSafe(url, { method: "GET", headers: { Range: "bytes=0-1024" } }, 8_000);
  if (get?.ok) {
    const ct = get.headers.get("content-type") ?? "";
    return ct.startsWith("image/");
  }
  return false;
}

function parseEventDate(text: string): string {
  const norm = text.replace(/\s+/g, " ");
  const m = norm.match(/\b([0-3]?\d)\/(0?\d|1[0-2])\/(20\d{2})\b/);
  if (!m) return "";
  const dd = m[1].padStart(2, "0");
  const mm = m[2].padStart(2, "0");
  const yyyy = m[3];
  return `${yyyy}-${mm}-${dd}`;
}

function parseIsoDate(text: string): string {
  const m = text.match(/\b(20\d{2})[-\/](0?\d|1[0-2])[-\/]([0-3]?\d)\b/);
  if (!m) return "";
  return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
}

function parseAnyDate(text: string, todayYmd: string): string {
  return (
    parseIsoDate(text) ||
    parseEventDate(text) ||
    parseEventDatePtBr(text, todayYmd)
  );
}

function normalizeYmdDate(input?: string | null): string | null {
  const raw = String(input ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/^(20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}-${m[3]}`;
}

function parseEventDatePtBr(text: string, todayYmd: string): string {
  const t = normalize(text);
  const m = t.match(/\b([0-3]?\d)\s+de\s+([a-zçãé]+)(?:\s+de\s+(20\d{2}))?\b/i);
  if (!m) return "";
  const dd = m[1].padStart(2, "0");
  const mm = MONTHS_PT[m[2]] ?? "";
  if (!mm) return "";
  let yyyy = m[3] ?? todayYmd.slice(0, 4);
  let ymd = `${yyyy}-${mm}-${dd}`;
  if (!m[3] && ymd < todayYmd) {
    yyyy = String(Number(yyyy) + 1);
    ymd = `${yyyy}-${mm}-${dd}`;
  }
  return ymd;
}

function parseEventDateFromHtml(html: string): string {
  const scripts =
    html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];

  for (const s of scripts) {
    try {
      const raw = s.replace(/<script[^>]*>|<\/script>/gi, "").trim();
      const parsed = JSON.parse(raw);
      const items: unknown[] = Array.isArray(parsed?.["@graph"])
        ? parsed["@graph"]
        : Array.isArray(parsed)
          ? parsed
          : [parsed];

      for (const item of items) {
        const rec = (item ?? {}) as Record<string, unknown>;
        const typeVal = String(rec["@type"] ?? "");
        const isEvent = /event/i.test(typeVal);
        const startDate = String(rec.startDate ?? rec.date ?? "");
        if (!isEvent || !startDate) continue;
        const ymd = startDate.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
        if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
      }
    } catch {
      // ignore
    }
  }

  const metaStart =
    getMeta(html, "event:start_time") ||
    getMeta(html, "article:published_time") ||
    "";
  if (metaStart) {
    const ymd = metaStart.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
    if (ymd) return `${ymd[1]}-${ymd[2]}-${ymd[3]}`;
  }
  const bodyDate = parseIsoDate(getBody(html));
  if (bodyDate) return bodyDate;
  return "";
}

async function fetchMirrorText(url: string): Promise<string> {
  const clean = url.replace(/^https?:\/\//i, "");
  const mirror = `https://r.jina.ai/http://${clean}`;
  const resp = await fetchSafe(mirror, {}, 12_000);
  if (!resp?.ok) return "";
  return await resp.text();
}

function extractHttpLinksFromText(text: string): string[] {
  const urls = text.match(/https?:\/\/[^\s<>"')\]]+/gi) ?? [];
  return [...new Set(urls.map((u) => normalizeCandidateUrl(u)))].filter((u) => isHttpUrl(u));
}

function parseEventLocationFromHtml(html: string): string {
  const scripts =
    html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const s of scripts) {
    try {
      const raw = s.replace(/<script[^>]*>|<\/script>/gi, "").trim();
      const parsed = JSON.parse(raw);
      const items: unknown[] = Array.isArray(parsed?.["@graph"])
        ? parsed["@graph"]
        : Array.isArray(parsed)
          ? parsed
          : [parsed];
      for (const item of items) {
        const rec = (item ?? {}) as Record<string, unknown>;
        const typeVal = String(rec["@type"] ?? "");
        if (!/event/i.test(typeVal)) continue;
        const location = rec.location as Record<string, unknown> | undefined;
        if (!location) continue;
        const name = String(location.name ?? "");
        const addrObj = (location.address ?? {}) as Record<string, unknown>;
        const city = String(addrObj.addressLocality ?? "");
        const state = String(addrObj.addressRegion ?? "");
        const out = `${name} ${city} ${state}`.trim();
        if (out) return out;
      }
    } catch {
      // ignore
    }
  }
  return "";
}

function extractJsonObjectsFromHtml(html: string): unknown[] {
  const out: unknown[] = [];
  const jsonLd =
    html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];
  for (const s of jsonLd) {
    try {
      const raw = s.replace(/<script[^>]*>|<\/script>/gi, "").trim();
      out.push(JSON.parse(raw));
    } catch {
      // ignore
    }
  }

  for (const re of [
    /__NEXT_DATA__["']?\s*[^>]*>([\s\S]*?)<\/script>/gi,
    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?});/gi,
    /window\.__NUXT__\s*=\s*({[\s\S]*?});/gi,
    /window\.__APOLLO_STATE__\s*=\s*({[\s\S]*?});/gi,
  ]) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(html)) !== null) {
      try {
        out.push(JSON.parse(m[1]));
      } catch {
        // ignore
      }
    }
  }
  return out;
}

function collectRawSignals(html: string, pageUrl: string, todayYmd: string): RawSignals {
  const body = getBody(html);
  const text = `${getTitle(html)} ${getMeta(html, "og:description")} ${body}`.slice(0, 12000);

  const dateCandidates = new Set<string>();
  const d1 = parseEventDateFromHtml(html);
  const d2 = parseEventDate(text);
  const d3 = parseEventDatePtBr(text, todayYmd);
  const d4 = parseIsoDate(text);
  if (d1) dateCandidates.add(d1);
  if (d2) dateCandidates.add(d2);
  if (d3) dateCandidates.add(d3);
  if (d4) dateCandidates.add(d4);

  const timeCandidates = new Set<string>();
  const h = parseHorario(text);
  if (h) timeCandidates.add(h);
  const hm = text.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/g) ?? [];
  for (const x of hm.slice(0, 5)) {
    const p = parseHorario(x);
    if (p) timeCandidates.add(p);
  }

  const locationCandidates = new Set<string>();
  const loc = parseEventLocationFromHtml(html);
  if (loc) locationCandidates.add(loc);
  const loc2 = text.match(/(?:local|onde)\s*[:\-]\s*([^\n\.]{4,120})/i)?.[1] ?? "";
  if (loc2) locationCandidates.add(loc2.trim());

  const titleCandidates = new Set<string>();
  const t1 = getTitle(html);
  if (t1) titleCandidates.add(t1);
  const t2 = getMeta(html, "og:title");
  if (t2) titleCandidates.add(t2);

  const imageCandidates = new Set<string>();
  const cimg = chooseBestImage(html, pageUrl);
  if (cimg) imageCandidates.add(cimg);
  const og = getMeta(html, "og:image");
  if (og) imageCandidates.add(toAbsoluteUrl(og, pageUrl));
  const tw = getMeta(html, "twitter:image");
  if (tw) imageCandidates.add(toAbsoluteUrl(tw, pageUrl));
  // Fallback para texto/espelho (ex.: r.jina.ai) com URLs diretas de imagem.
  for (const img of text.match(/https?:\/\/[^\s"'<>]+?\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'<>]*)?/gi) ?? []) {
    imageCandidates.add(normalizeCandidateUrl(img));
  }

  const ticketCandidates = new Set<string>();
  for (const u of extractLinks(html, pageUrl)) {
    if (TICKET_HOST_RE.test(u) || /\/comprar|\/checkout|ingresso/i.test(u)) {
      ticketCandidates.add(u);
    }
  }
  if (TICKET_HOST_RE.test(pageUrl)) ticketCandidates.add(pageUrl);

  for (const obj of extractJsonObjectsFromHtml(html)) {
    const walk = (v: unknown) => {
      if (v == null) return;
      if (typeof v === "string") {
        const s = decodeEntities(v).trim();
        if (!s) return;
        if (/^https?:\/\//i.test(s)) {
          if (/\.(jpg|jpeg|png|webp|avif)(\?|$)/i.test(s) || /image|banner|cover|flyer/i.test(s)) {
            imageCandidates.add(normalizeCandidateUrl(s));
          }
          if (TICKET_HOST_RE.test(s) || /\/comprar|\/checkout|ingresso/i.test(s)) {
            ticketCandidates.add(normalizeCandidateUrl(s));
          }
        }
        const d = parseAnyDate(s, todayYmd);
        if (d) dateCandidates.add(d);
        const hr = parseHorario(s);
        if (hr) timeCandidates.add(hr);
        if (GV_RE.test(normalize(s)) || /colegio|teatro|audit[oó]rio|centro|shopping/i.test(normalize(s))) {
          locationCandidates.add(s.slice(0, 120));
        }
        if (s.length > 12 && s.length < 140 && EVENT_KEYWORDS_RE.test(normalize(s))) {
          titleCandidates.add(s);
        }
        return;
      }
      if (Array.isArray(v)) {
        for (const x of v.slice(0, 80)) walk(x);
        return;
      }
      if (typeof v === "object") {
        const rec = v as Record<string, unknown>;
        for (const [k, val] of Object.entries(rec).slice(0, 300)) {
          if (
            ["name", "title", "headline", "description", "startDate", "date", "location", "image", "url", "eventDate", "dateTime", "start_time", "session", "sessions"].includes(k) ||
            /date|hora|time|session|evento|city|local|venue|place|start/i.test(k)
          ) {
            walk(val);
          }
        }
      }
    };
    walk(obj);
  }

  return {
    titleCandidates: [...titleCandidates].filter(Boolean).slice(0, 8),
    dateCandidates: [...dateCandidates].filter(Boolean).slice(0, 6),
    timeCandidates: [...timeCandidates].filter(Boolean).slice(0, 6),
    locationCandidates: [...locationCandidates].filter(Boolean).slice(0, 6),
    imageCandidates: [...imageCandidates].filter(Boolean).slice(0, 8),
    ticketCandidates: [...ticketCandidates].filter(Boolean).slice(0, 8),
    textExcerpt: text.slice(0, 4000),
  };
}

function extractEventLinksFromJsonLd(html: string, baseUrl: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  const scripts =
    html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) ?? [];

  const add = (raw: string) => {
    const u = toAbsoluteUrl(String(raw ?? ""), baseUrl);
    if (!u || seen.has(u)) return;
    seen.add(u);
    out.push(u);
  };

  for (const s of scripts) {
    try {
      const raw = s.replace(/<script[^>]*>|<\/script>/gi, "").trim();
      const parsed = JSON.parse(raw);
      const items: unknown[] = Array.isArray(parsed?.["@graph"])
        ? parsed["@graph"]
        : Array.isArray(parsed)
          ? parsed
          : [parsed];

      for (const item of items) {
        const rec = (item ?? {}) as Record<string, unknown>;
        const typeVal = String(rec["@type"] ?? "");
        if (/event/i.test(typeVal)) {
          add(String(rec.url ?? ""));
          const offers = rec.offers as Record<string, unknown> | Record<string, unknown>[] | undefined;
          if (Array.isArray(offers)) {
            for (const o of offers) add(String((o ?? {}).url ?? ""));
          } else if (offers) {
            add(String(offers.url ?? ""));
          }
        }
      }
    } catch {
      // ignore
    }
  }
  return out;
}

function parseHorario(text: string): string {
  const m = text.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/i);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function inferCategory(text: string): string {
  const t = normalize(text);
  if (/stand\s?up|comedia|comedia/.test(t)) return "stand-up";
  if (/teatro|espetaculo/.test(t)) return "teatro";
  if (/show|musica|festival/.test(t)) return "show";
  return "evento";
}

function jaccard(a: string, b: string): number {
  const words = (s: string) => new Set(normalize(s).split(/\W+/).filter((w) => w.length > 3));
  const wa = words(a);
  const wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

function candidateScore(c: Candidate): number {
  const u = normalize(c.url);
  let s = 0;
  if (/governador-valadares|governador valadares|valadares/.test(u)) s += 120;
  if (/sympla\.com\.br\/evento\//.test(u)) s += 90;
  if (/ingresso\.com\/evento\//.test(u)) s += 90;
  if (/eventbrite\..+\/e\//.test(u)) s += 60;
  if (/festival-anime|startup-day|anime-gv|sebrae|sesi/.test(u)) s += 70;
  if (/(evento|eventos|show|teatro|stand-up|festival|cultura|startup|anime)/.test(u)) s += 40;
  if (NON_EVENT_URL_RE.test(u)) s -= 120;
  if (BLOCKED_LINK_RE.test(u) || INSTITUTIONAL_URL_RE.test(u)) s -= 180;
  if (/show-da-madonna|proximos-jogos|agendamento/.test(u)) s -= 250;
  return s;
}

async function rewriteEventWithAI(titulo: string, descricao: string, apiKey: string): Promise<{ titulo: string; descricao: string } | null> {
  const prompt = `Voce e redator jornalistico especializado em agenda cultural de Governador Valadares.
Reescreva o titulo e a descricao do evento mantendo fatos, sem inventar.
- Titulo: chamativo, maximo 120 caracteres.
- Descricao: 2 ou 3 paragrafos curtos, facil leitura.

TITULO ORIGINAL: ${titulo}
DESCRICAO ORIGINAL: ${descricao.slice(0, 2000)}

Responda APENAS JSON valido:
{"titulo":"...","descricao":"..."}`;

  const resp = await fetchSafe(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.3,
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    30_000,
  );

  if (!resp?.ok) return null;

  try {
    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (typeof parsed.titulo === "string" && typeof parsed.descricao === "string") {
      return {
        titulo: parsed.titulo.slice(0, 120),
        descricao: parsed.descricao,
      };
    }
  } catch {
    // ignore
  }

  return null;
}

async function validateEventWithAI(input: {
  titulo: string;
  descricao: string;
  url: string;
  fonte: string;
  data_evento?: string;
  local_texto?: string;
}, apiKey: string): Promise<{ aprovado: boolean; motivo: string; data_evento?: string; local_nome?: string } | null> {
  const prompt = `Voce e um validador de agenda local.
Objetivo: aprovar apenas eventos reais relacionados a Governador Valadares-MG.
Regras:
- REPROVAR paginas institucionais, categorias, noticias gerais, esportes nacionais, conteudo sem evento.
- APROVAR somente se houver indicio forte de evento (show, teatro, stand-up, festival, palestra etc.) E relacao com Governador Valadares.
- Se encontrar data do evento, devolver em YYYY-MM-DD.

Dados:
Fonte: ${input.fonte}
URL: ${input.url}
Titulo: ${input.titulo}
Descricao: ${input.descricao.slice(0, 2500)}
Data detectada: ${input.data_evento ?? ""}
Local detectado: ${input.local_texto ?? ""}

Responda APENAS JSON valido:
{"aprovado":true|false,"motivo":"curto","data_evento":"YYYY-MM-DD ou vazio","local_nome":"texto curto ou vazio"}`;

  const resp = await fetchSafe(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 280,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    25_000,
  );

  if (!resp?.ok) return null;

  try {
    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      aprovado: Boolean(parsed.aprovado),
      motivo: String(parsed.motivo ?? ""),
      data_evento: String(parsed.data_evento ?? "").trim() || undefined,
      local_nome: String(parsed.local_nome ?? "").trim() || undefined,
    };
  } catch {
    return null;
  }
}

async function extractEventWithAI(input: {
  url: string;
  fonte: string;
  raw: RawSignals;
}, apiKey: string): Promise<{
  aprovado: boolean;
  motivo: string;
  is_gv: boolean;
  titulo?: string;
  descricao?: string;
  data_evento?: string;
  horario?: string;
  local_nome?: string;
  imagem_url?: string;
  link_ingresso?: string;
} | null> {
  const prompt = `Voce extrai dados de eventos locais.
Tarefa: identificar se a URL abaixo representa um evento real de Governador Valadares-MG.
Use SOMENTE os sinais fornecidos; nao invente dados.

URL: ${input.url}
Fonte: ${input.fonte}

Sinais:
${JSON.stringify(input.raw).slice(0, 7000)}

Regras:
- aprovado=true apenas se for evento real.
- is_gv=true apenas se houver indicio de Governador Valadares-MG.
- data_evento no formato YYYY-MM-DD quando houver.
- horario no formato HH:mm quando houver.
- escolher imagem_url valida dentre imageCandidates.

Responda APENAS JSON:
{"aprovado":true,"motivo":"...","is_gv":true,"titulo":"...","descricao":"...","data_evento":"YYYY-MM-DD","horario":"HH:mm","local_nome":"...","imagem_url":"...","link_ingresso":"..."}`;

  const resp = await fetchSafe(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0,
        max_tokens: 700,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    30_000,
  );
  if (!resp?.ok) return null;
  try {
    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]) as Record<string, unknown>;
    return {
      aprovado: Boolean(parsed.aprovado),
      motivo: String(parsed.motivo ?? ""),
      is_gv: Boolean(parsed.is_gv),
      titulo: String(parsed.titulo ?? "").trim() || undefined,
      descricao: String(parsed.descricao ?? "").trim() || undefined,
      data_evento: String(parsed.data_evento ?? "").trim() || undefined,
      horario: String(parsed.horario ?? "").trim() || undefined,
      local_nome: String(parsed.local_nome ?? "").trim() || undefined,
      imagem_url: String(parsed.imagem_url ?? "").trim() || undefined,
      link_ingresso: String(parsed.link_ingresso ?? "").trim() || undefined,
    };
  } catch {
    return null;
  }
}

async function loadFontes(supabase: ReturnType<typeof createClient>, cidadeId: string, log: LogFn): Promise<FonteEvento[]> {
  const { data, error } = await supabase
    .from("cidade_scraping_evento_fonte")
    .select("nome, tipo, url, ativo, ordem")
    .eq("cidade_id", cidadeId)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    log(`⚠ Falha ao carregar fontes de eventos: ${error.message}`, "warn");
    return DEFAULT_FONTES;
  }

  const mapped = (data ?? [])
    .map((row: Record<string, unknown>) => ({
      nome: String(row.nome ?? "").trim(),
      tipo: row.tipo === "rss" ? "rss" as const : "html" as const,
      url: String(row.url ?? "").trim(),
    }))
    .filter((f) => f.nome && isHttpUrl(f.url));

  if (mapped.length === 0) {
    log("⚠ Nenhuma fonte de eventos ativa; usando fontes padrao", "warn");
    return DEFAULT_FONTES;
  }

  return mapped;
}

async function runEventoScraping(opts: {
  cidadeId: string;
  lookbackDays: number;
  maxEvents: number;
  rewriteAiEnabled: boolean;
  validateAiEnabled: boolean;
  openaiKey: string;
  supabase: ReturnType<typeof createClient>;
  log: LogFn;
}): Promise<Stats> {
  const {
    cidadeId,
    lookbackDays,
    maxEvents,
    rewriteAiEnabled,
    validateAiEnabled,
    openaiKey,
    supabase,
    log,
  } = opts;

  const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
  const minDate = new Date(Date.now() - 3 * 3600_000 - lookbackDays * 86_400_000).toISOString().slice(0, 10);

  const stats: Stats = {
    data_processada: today.split("-").reverse().join("/"),
    inseridos: 0,
    antigas_rejeitadas: 0,
    duplicados: 0,
    sem_imagem: 0,
    sem_data: 0,
    urls_invalidas: 0,
    erros: [],
  };

  log(`📅 Hoje: ${today} | Min: ${minDate} | Limite: ${maxEvents}`);
  if (openaiKey) {
    log(`🤖 IA: reescrita ${rewriteAiEnabled ? "ATIVA" : "DESATIVADA"} | validacao ${validateAiEnabled ? "ATIVA" : "DESATIVADA"}`);
  } else {
    log("⚠ IA desativada: sem OPENAI_API_KEY", "warn");
  }

  const [existingWithDateRes, existingNoDateRes] = await Promise.all([
    supabase
      .from("rel_cidade_eventos")
      .select("id, titulo, data_evento, link_ingresso, created_at")
      .eq("cidade_id", cidadeId)
      .gte("data_evento", minDate)
      .order("data_evento", { ascending: false })
      .limit(1200),
    supabase
      .from("rel_cidade_eventos")
      .select("id, titulo, data_evento, link_ingresso, created_at")
      .eq("cidade_id", cidadeId)
      .is("data_evento", null)
      .order("created_at", { ascending: false })
      .limit(800),
  ]);

  const existingRowsById = new Map<string, Record<string, unknown>>();
  for (const row of (existingWithDateRes.data ?? [])) {
    if (row?.id) existingRowsById.set(String(row.id), row as Record<string, unknown>);
  }
  for (const row of (existingNoDateRes.data ?? [])) {
    if (row?.id) existingRowsById.set(String(row.id), row as Record<string, unknown>);
  }
  const existingRows = [...existingRowsById.values()];
  const fontes = await loadFontes(supabase, cidadeId, log);
  log(`🧩 Fontes de eventos ativas: ${fontes.length}`);

  const candidates: Candidate[] = [];

  for (const fonte of fontes) {
    log(`🔍 ${fonte.nome}...`);
    const resp = await fetchSafe(fonte.url, {}, 20_000);
    const html = resp?.ok ? await resp.text() : "";
    if (!resp?.ok) {
      log(` ⚠ ${fonte.nome}: falha direta (${resp?.status ?? "timeout"})`, "warn");
    }

    const nomeFonte = normalize(fonte.nome);
    const jsonLdLinks = html ? extractEventLinksFromJsonLd(html, fonte.url) : [];
    const pageLinks = html ? extractLinksByFonte(html, fonte.url, fonte.nome) : [];
    const seedLinks: string[] = [];
    if (/sympla/.test(nomeFonte) || /ingresso/.test(nomeFonte)) {
      const seedUrls = buildPlatformSeedUrls(fonte);
      for (const seedUrl of seedUrls) {
        const r = await fetchSafe(seedUrl, {}, 15_000);
        const seedHtml = r?.ok ? await r.text() : "";
        if (seedHtml) {
          seedLinks.push(...extractLinksByFonte(seedHtml, seedUrl, fonte.nome));
        }
      }
    }

    const symplaSitemapLinks = /sympla/.test(nomeFonte)
      ? await fetchSitemapLinks({
          sitemapUrl: "https://www.sympla.com.br/sitemap.xml",
          mustContain: /sympla\.com\.br\/evento\//i,
          keywordFilter: /(governador-valadares|governador valadares|valadares)/i,
          limit: 150,
        })
      : [];
    const ingressoSitemapLinks = /ingresso/.test(nomeFonte)
      ? await fetchIngressoSitemapGovValadaresLinks(log)
      : [];

    const links = [
      ...pageLinks,
      ...jsonLdLinks,
      ...seedLinks,
      ...symplaSitemapLinks,
      ...ingressoSitemapLinks,
    ]
      .filter((u) => EVENT_KEYWORDS_RE.test(normalize(u)) || TICKET_HOST_RE.test(u))
      .filter((u) => isEventDetailUrl(u, fonte.nome))
      .filter((u) => isAllowedCandidateForFonte(u, fonte))
      .filter((u) => !NON_EVENT_URL_RE.test(u))
      .slice(0, 120)
      .map((url) => ({ url, fonte: fonte.nome }));

    // Se a URL da fonte já for uma página de evento, processa direto.
    const directFromFonte: Candidate[] = [];
    if ((/\/evento\//i.test(fonte.url) || /eventbrite\.com\/e\//i.test(fonte.url)) && isEventDetailUrl(fonte.url, fonte.nome)) {
      directFromFonte.push({ url: fonte.url, fonte: fonte.nome });
    }

    candidates.push(...links, ...directFromFonte);
    log(` ✅ ${fonte.nome}: ${links.length + directFromFonte.length} links`);
  }

  const seen = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seen.has(c.url)) return false;
    seen.add(c.url);
    return true;
  });

  const prioritized = unique
    .filter((c) => isHttpUrl(c.url))
    .filter((c) => !INSTITUTIONAL_URL_RE.test(c.url))
    .sort((a, b) => candidateScore(b) - candidateScore(a));

  const scanLimit = Math.min(prioritized.length, Math.max(maxEvents * 4, 140));
  const toScan = prioritized.slice(0, scanLimit);

  log(`📊 ${candidates.length} candidatos -> ${unique.length} unicos`);
  log(`⚙️ Priorizados: ${prioritized.length} | varrendo ${toScan.length} (meta: ate ${maxEvents})`, "info");
  let aiChecks = 0;
  const aiMaxChecks = Math.max(30, maxEvents * 2);

  for (let i = 0; i < toScan.length; i++) {
    const candidate = toScan[i];
    if (stats.inseridos >= maxEvents) break;
    try {
      const originalUrl = candidate.url;
      const candidateUrl = sanitizeEventUrl(normalizeCandidateUrl(candidate.url));
      if (!candidateUrl || !isHttpUrl(candidateUrl)) {
        stats.urls_invalidas++;
        log(` ✗ [url invalida] ${originalUrl.slice(0, 120)}`, "warn");
        continue;
      }
      if (candidateUrl !== originalUrl) {
        log(`  🧹 url corrigida`, "info");
        log(`  ↪ de: ${originalUrl}`, "info");
        log(`  ↪ para: ${candidateUrl}`, "info");
      }
      log(`\n🧭 [${i + 1}/${toScan.length}] ${candidate.fonte}`, "info");
      log(`📰 evento ${i + 1} encontrado`, "info");
      log(`  step 1/4: buscar evento`, "info");
      log(`  🔗 evento: ${candidateUrl}`, "info");
      const candidateText = normalize(`${candidate.fonte} ${candidateUrl}`);
      // Hard guard para Eventbrite: exige indicio explicito de GV.
      if (/eventbrite/i.test(candidateText) && !/(governador-valadares|governador valadares|valadares-mg)/i.test(candidateText)) {
        stats.urls_invalidas++;
        continue;
      }

      if (NON_EVENT_URL_RE.test(candidateUrl) || INSTITUTIONAL_URL_RE.test(candidateUrl)) {
        stats.urls_invalidas++;
        continue;
      }

      let html = "";
      const pageResp = await fetchSafe(candidateUrl, {}, 15_000);
      if (pageResp?.ok) {
        html = await pageResp.text();
      } else {
        const isSympla = /sympla/i.test(candidate.fonte) || /sympla\.com\.br/i.test(candidateUrl);
        if (isSympla) {
          const mirrorText = await fetchMirrorText(candidateUrl);
          if (mirrorText) {
            const fallbackTitle = inferTitleFromEventUrl(candidateUrl) || "evento sympla";
            html =
              `<html><head><title>${fallbackTitle}</title></head><body>${mirrorText}</body></html>`;
            log(`  ↺ fallback sympla via espelho`, "warn");
          }
        }
      }
      if (!html) {
        log(` ✗ [fetch] ${candidateUrl.slice(0, 120)} (${pageResp?.status ?? "timeout"})`, "warn");
        continue;
      }
      log(`  step 2/4: conferir duplicidade e dados`, "info");

      const tituloOriginal = getTitle(html) || inferTitleFromEventUrl(candidateUrl);
      if (!tituloOriginal || tituloOriginal.length < 10) {
        stats.urls_invalidas++;
        continue;
      }

      if (/show da madonna|proximos jogos|agendamento/i.test(normalize(tituloOriginal))) {
        stats.urls_invalidas++;
        continue;
      }

      const descMeta = getMeta(html, "og:description");
      const body = getBody(html);
      const descricaoBase = descMeta || body.slice(0, 1800);
      const raw = collectRawSignals(html, candidateUrl, today);

      const locationText = raw.locationCandidates[0] ?? parseEventLocationFromHtml(html);
      const relevanceText = normalize(`${tituloOriginal} ${descricaoBase} ${locationText} ${candidateUrl} ${raw.textExcerpt}`);
      const urlHasGv = /governador-valadares/i.test(candidateUrl);
      const heuristicGv = GV_RE.test(relevanceText) || urlHasGv;

      let dataEvento =
        raw.dateCandidates[0] ||
        parseEventDateFromHtml(html) ||
        parseEventDate(`${tituloOriginal} ${descricaoBase}`) ||
        parseEventDatePtBr(`${tituloOriginal} ${descricaoBase} ${body}`, today);
      const localDetectado = locationText || (descricaoBase.match(/(?:local|onde)\s*[:\-]\s*([^\n\.]{4,100})/i)?.[1] ?? "").trim();

      let aiValidation: { aprovado: boolean; motivo: string; data_evento?: string; local_nome?: string } | null = null;
      let aiExtract: {
        aprovado: boolean;
        motivo: string;
        is_gv: boolean;
        titulo?: string;
        descricao?: string;
        data_evento?: string;
        horario?: string;
        local_nome?: string;
        imagem_url?: string;
        link_ingresso?: string;
      } | null = null;

      const strongHeuristic =
        (/governador-valadares|governador valadares|valadares/.test(normalize(`${candidateUrl} ${tituloOriginal} ${descricaoBase} ${localDetectado}`))) &&
        Boolean(dataEvento);

      if (validateAiEnabled && openaiKey && aiChecks < aiMaxChecks && !strongHeuristic) {
        aiChecks++;
        aiExtract = await extractEventWithAI({
          url: candidateUrl,
          fonte: candidate.fonte,
          raw,
        }, openaiKey);
        if (!aiExtract) {
          aiValidation = await validateEventWithAI({
            titulo: tituloOriginal,
            descricao: descricaoBase,
            url: candidateUrl,
            fonte: candidate.fonte,
            data_evento: dataEvento,
            local_texto: localDetectado,
          }, openaiKey);
        }
      }

      if (aiExtract?.data_evento && !dataEvento) dataEvento = aiExtract.data_evento;
      if (aiValidation?.data_evento && !dataEvento) dataEvento = aiValidation.data_evento;

      // Fallback forte para páginas de ticketing que carregam detalhes via JS.
      if (!dataEvento && TICKET_HOST_RE.test(candidateUrl)) {
        const mirrorText = await fetchMirrorText(candidateUrl);
        const mirrorDate = parseAnyDate(mirrorText, today);
        if (mirrorDate) {
          dataEvento = mirrorDate;
        }
      }
      const dataEventoNorm = normalizeYmdDate(dataEvento);

      if (validateAiEnabled) {
        const aprovado = aiExtract ? (aiExtract.aprovado && aiExtract.is_gv) : (aiValidation ? aiValidation.aprovado : heuristicGv);
        if (!aprovado) {
          stats.urls_invalidas++;
          const motivo = aiExtract?.motivo || aiValidation?.motivo || "";
          log(` ✗ [fora gv] ${tituloOriginal.slice(0, 70)}${motivo ? `: ${motivo}` : ""}`, "warn");
          continue;
        }
      } else if (!heuristicGv) {
        stats.urls_invalidas++;
        log(` ✗ [fora gv] ${tituloOriginal.slice(0, 70)}`, "warn");
        continue;
      }

      if (!dataEventoNorm) {
        stats.sem_data++;
        log(` ⚠ [sem data] inserindo sem data_evento: ${tituloOriginal.slice(0, 70)}`, "warn");
      }

      if (dataEventoNorm && dataEventoNorm < today) {
        stats.antigas_rejeitadas++;
        log(` ✗ [passado ${dataEventoNorm}] ${tituloOriginal.slice(0, 70)}`, "warn");
        continue;
      }

      const dupe = existingRows.find((e: Record<string, unknown>) =>
        (
          normalizeCandidateUrl(String(e.link_ingresso ?? "")) === candidateUrl
        ) ||
        (
          (
            (dataEventoNorm && e.data_evento === dataEventoNorm) ||
            (!dataEventoNorm && !e.data_evento)
          ) && jaccard(String(e.titulo ?? ""), tituloOriginal) > 0.82
        ) ||
        (
          !dataEventoNorm &&
          jaccard(String(e.titulo ?? ""), tituloOriginal) > 0.91
        ),
      );

      if (dupe) {
        stats.duplicados++;
        log(` ✗ [duplicado] ${tituloOriginal.slice(0, 70)}`, "warn");
        continue;
      }

      const imagemUrl =
        aiExtract?.imagem_url ||
        raw.imageCandidates[0] ||
        chooseBestImage(html, candidateUrl);
      log(`  step 3/4: pegar dados de imagem e data`, "info");
      if (!(await validateImage(imagemUrl))) {
        stats.sem_imagem++;
        log(` ✗ [sem imagem valida] ${tituloOriginal.slice(0, 70)}`, "warn");
        continue;
      }

      let titulo = aiExtract?.titulo || tituloOriginal;
      let descricao = aiExtract?.descricao || descricaoBase;

      if (openaiKey && rewriteAiEnabled) {
        const rewritten = await rewriteEventWithAI(tituloOriginal, descricaoBase, openaiKey);
        if (rewritten) {
          titulo = rewritten.titulo;
          descricao = rewritten.descricao;
        }
      }

      const horario = aiExtract?.horario || raw.timeCandidates[0] || parseHorario(`${tituloOriginal} ${descricaoBase}`);
      const localNome = aiExtract?.local_nome || aiValidation?.local_nome || localDetectado;
      const ingressoLink =
        aiExtract?.link_ingresso ||
        raw.ticketCandidates[0] ||
        extractLinks(html, candidateUrl).find((u) => TICKET_HOST_RE.test(u)) ||
        null;

      const { error } = await supabase.from("rel_cidade_eventos").insert({
        cidade_id: cidadeId,
        titulo: titulo.slice(0, 120),
        descricao,
        imagem_url: imagemUrl,
        data_evento: dataEventoNorm,
        horario: horario || null,
        local_nome: localNome || null,
        local_endereco: null,
        categoria: inferCategory(`${titulo} ${descricao}`),
        preco: null,
        link_ingresso: ingressoLink,
        destaque: false,
        ativo: true,
      });

      if (error) {
        stats.erros.push(error.message);
        log(` ✗ [db] ${titulo.slice(0, 60)}: ${error.message}`, "err");
        continue;
      }

      log(`  step 4/4: postar`, "info");
      stats.inseridos++;
      existingRows.push({ titulo, data_evento: dataEventoNorm, link_ingresso: ingressoLink });
      log(` ✓ Inserido: ${titulo.slice(0, 70)}`, "ok");
      if (i < toScan.length - 1 && stats.inseridos < maxEvents) {
        log(`➡️ proximo evento`, "info");
      }
    } catch (e) {
      stats.erros.push(String(e));
      log(` ✗ [erro] ${candidateUrl.slice(0, 90)}: ${String(e).slice(0, 140)}`, "err");
      continue;
    }
  }

  log(`🏁 Concluido! ${stats.inseridos} inserido(s) | ${stats.duplicados} dup | ${stats.antigas_rejeitadas} passados`, "ok");
  return stats;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let params: {
    cidade_id?: string;
    stream?: boolean;
    rewrite_ai?: boolean;
    validate_ai?: boolean;
    lookback_days?: number;
    max_events?: number;
  } = {};

  try {
    params = await req.json();
  } catch {
    // no body
  }

  const cidadeId = params.cidade_id ?? DEFAULT_CIDADE_ID;
  const streamMode = params.stream === true;
  const rewriteAiEnabled = params.rewrite_ai !== false;
  const validateAiEnabled = params.validate_ai !== false;
  const lookbackDays = Math.min(Math.max(params.lookback_days ?? LOOKBACK_DAYS_DEFAULT, 1), 30);
  const maxEvents = Math.min(Math.max(params.max_events ?? MAX_EVENTS_DEFAULT, 5), 120);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";

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
        const stats = await runEventoScraping({
          cidadeId,
          lookbackDays,
          maxEvents,
          rewriteAiEnabled,
          validateAiEnabled,
          openaiKey,
          supabase,
          log,
        });
        send({ type: "done", ...stats });
      } catch (e) {
        send({ type: "error", msg: String(e) });
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        ...CORS,
      },
    });
  }

  try {
    const stats = await runEventoScraping({
      cidadeId,
      lookbackDays,
      maxEvents,
      rewriteAiEnabled,
      validateAiEnabled,
      openaiKey,
      supabase,
      log: () => {},
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
