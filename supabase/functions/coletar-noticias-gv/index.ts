import { createClient } from "jsr:@supabase/supabase-js@2";

// ═══════════════════════════════════════════════════════════════════════════════
// OpenCity — Coletor de Notícias de Governador Valadares v3.0
// ═══════════════════════════════════════════════════════════════════════════════
//
// Estratégia:
//   1. Coleta links de 4 fontes (G1 RSS + 3 portais HTML)
//   2. Pré-filtra por URL, data, dedup
//   3. Fetch do artigo → extrai título, descrição, data, imagens
//   4. Filtra por relevância geográfica (GV)
//   5. Valida imagem (HEAD request, tamanho > 10KB, tipo correto)
//   6. Reescreve com IA (OpenAI GPT-4o-mini) — texto SEPARADO da imagem
//   7. Insere no Supabase
//
// Correções em relação a versões anteriores:
//   - IA NÃO escolhe imagem (evita truncamento de URL)
//   - Filtro de imagem do G1 mais preciso (bloqueia só thumbnails de vídeo)
//   - Filtro de URLs de categoria do DeFato no BLOCKED_SEGS_RE
//   - Fallback robusto de imagem: og:image → JSON-LD → CDN Globo → <img>
//   - Log de diagnóstico detalhado em cada etapa
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Config ───────────────────────────────────────────────────────────────────

const DEFAULT_CIDADE_ID = "2bafc0da-6960-403b-b25b-79f72066775a";
const CONCURRENCY_NO_AI = 10;
const MAX_ARTICLES_DEFAULT = 60;
const LOOKBACK_DAYS_DEFAULT = 2;
const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
  "Cache-Control": "no-cache",
};

const DEFAULT_FONTES = [
  {
    nome: "G1 Vales",
    tipo: "rss" as const,
    url: "https://g1.globo.com/rss/g1/mg/vales-mg/",
    localGV: false,
  },
  {
    nome: "Diário do Rio Doce",
    tipo: "html" as const,
    url: "https://drd.com.br/",
    localGV: true,
  },
  {
    nome: "Jornal da Cidade",
    tipo: "html" as const,
    url: "https://jornaldacidadevalesdeminas.com/",
    localGV: true,
  },
  {
    nome: "DeFato Online",
    tipo: "html" as const,
    url: "https://defatoonline.com.br/localidades/governador-valadares/",
    localGV: false,
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

interface Candidate {
  url: string;
  fonte: string;
  localGV: boolean;
  rssTitle?: string;
  rssDesc?: string;
  rssImage?: string;
  rssDate?: string;
}

interface FonteConfig {
  nome: string;
  tipo: "rss" | "html";
  url: string;
  localGV: boolean;
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
type InsertedNews = { titulo: string; fonte: string };

// ─── Fetch ────────────────────────────────────────────────────────────────────

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

async function triggerJornalAudioGeneration(
  jornalId: string,
  log?: LogFn,
): Promise<void> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) {
    log?.(`  ⚠️ áudio não acionado: env ausente`, "warn");
    return;
  }

  const resp = await fetchSafe(
    `${supabaseUrl}/functions/v1/generate-jornal-audio`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ jornalId }),
    },
    25_000,
  );

  if (!resp) {
    log?.(`  ⚠️ áudio não acionado: timeout`, "warn");
    return;
  }
  if (!resp.ok) {
    const body = await resp.text().catch(() => "");
    log?.(`  ⚠️ áudio não acionado: HTTP ${resp.status} ${body.slice(0, 120)}`, "warn");
    return;
  }
  log?.(`  🔊 fluxo de áudio acionado`, "ok");
}

// ─── Date helpers (BRT = UTC-3) ───────────────────────────────────────────────

function todayBRT(): string {
  return new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10);
}

function minDateBRT(days: number): string {
  return new Date(Date.now() - 3 * 3600_000 - days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

// ─── HTML Utilities ───────────────────────────────────────────────────────────

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
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']{1,1000})["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']{1,1000})["'][^>]+(?:property|name)=["']${prop}["']`,
      "i",
    ),
  ]) {
    const m = html.match(re);
    if (m?.[1]) return decodeEntities(m[1].trim());
  }
  return "";
}

function cleanTitle(raw: string): string {
  return decodeEntities(raw)
    .replace(/<[^>]+>/g, "")
    .replace(
      /\s*[-|–—]\s*(Diário do Rio Doce|G1 Vales|G1|Jornal da Cidade|DeFato Online|Globo\.com|Portal|DRD)[^$]*/i,
      "",
    )
    .trim();
}

function getTitle(html: string): string {
  const og = getMeta(html, "og:title");
  if (og) return cleanTitle(og);
  const h1 = html.match(
    /<h1[^>]*>\s*(?:<[^>]+>)*([^<]{5,200}?)(?:<[^>]+>)*\s*<\/h1>/i,
  );
  if (h1?.[1]) return cleanTitle(h1[1]);
  const title = html.match(/<title[^>]*>([^<]{5,300})<\/title>/i);
  if (title?.[1]) return cleanTitle(title[1]);
  return "";
}

function getOgDesc(html: string): string {
  return getMeta(html, "og:description") || getMeta(html, "description");
}

function getPublishedDate(html: string): string {
  // 1. JSON-LD
  const scripts =
    html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ) ?? [];
  for (const s of scripts) {
    try {
      const parsed = JSON.parse(s.replace(/<[^>]+>/g, ""));
      const items: unknown[] = Array.isArray(parsed["@graph"])
        ? parsed["@graph"]
        : [parsed];
      for (const item of items) {
        const d = (item as Record<string, string>)["datePublished"];
        if (d) return d.slice(0, 10);
      }
    } catch {
      /* ignore */
    }
  }
  // 2. Meta tags
  const pub =
    getMeta(html, "article:published_time") ||
    getMeta(html, "datePublished");
  if (pub) return pub.slice(0, 10);
  // 3. <time datetime>
  const time = html.match(
    /<time[^>]+datetime=["'](\d{4}-\d{2}-\d{2}[^"']*)["']/i,
  );
  if (time?.[1]) return time[1].slice(0, 10);
  return "";
}

// ─── Image extraction (robusto, sem IA) ───────────────────────────────────────

// Bloqueia logos, ícones, social, tracking
const BLOCKED_IMG_RE =
  /(\/logo[s]?\/|\/icon[s]?\/|\/favicon|avatar|whatsapp[-_.]|telegram[-_.]|instagram[-_.]|facebook[-_.]|twitter[-_.]|tiktok[-_.]|youtube[-_.]|linkedin[-_.]|pinterest[-_.]|pixel|tracking|badge|social[-_]|share[-_]|\/ads\/|advertisement|placeholder|default[-_]img|spinner|loading|banner[-_]lateral|widget)/i;

// Bloqueia extensões de imagem não-fotográficas
const BLOCKED_IMG_EXT_RE = /\.(gif|svg|ico)(\?.*)?$/i;

// G1: bloqueia APENAS thumbnails de vídeo pequenas do CDN de vídeos
// Padrão: s04.video.glbimg.com/.../x72/ ou /x120/ ou /x216/ ou /x240/
// NÃO bloqueia: s2.glbimg.com (fotos), i.s3.glbimg.com (fotos de artigo)
const G1_VIDEO_THUMB_RE =
  /video\.glbimg\.com\/(?:.*\/)?x\d{2,4}\//i;
const G1_INTERNAL_PRIVATE_IMG_RE =
  /^https?:\/\/i\.s3\.glbimg\.com\/v1\/AUTH_[^/]+\/internal_photos\//i;

// Logo do G1 em SVG/PNG que aparece no RSS e às vezes como og:image fallback
const G1_LOGO_RE =
  /\/g1-logo|g1_logo|logo[-_]g1|globo[-_]logo|\/brand[s]?\//i;

function isBlockedImage(url: string): boolean {
  if (!url?.startsWith("http")) return true;
  if (BLOCKED_IMG_RE.test(url)) return true;
  if (BLOCKED_IMG_EXT_RE.test(url)) return true;
  if (G1_VIDEO_THUMB_RE.test(url)) return true;
  if (G1_INTERNAL_PRIVATE_IMG_RE.test(url)) return true;
  if (G1_LOGO_RE.test(url)) return true;
  return false;
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

function extractMainContentHtml(html: string): string {
  let main = html.replace(
    /<(script|style|noscript|nav|header|footer|aside|form)[^>]*>[\s\S]*?<\/\1>/gi,
    " ",
  );
  for (const re of [
    /<article[^>]*>([\s\S]{200,}?)<\/article>/i,
    /class=["'][^"']*(?:entry-content|post-content|article-body|materia-texto|corpo-texto|td-post-content|single-content|conteudo)[^"']*["'][^>]*>([\s\S]{200,})/i,
    /itemprop=["']articleBody["'][^>]*>([\s\S]{200,})/i,
    /<main[^>]*>([\s\S]{200,})/i,
  ]) {
    const m = main.match(re);
    if (m?.[1]) {
      main = m[1];
      break;
    }
  }
  return main;
}

function detectImageOrigin(
  html: string,
  pageUrl: string,
  rssImage: string | undefined,
  chosenImage: string,
): string {
  const normalize = (raw: string): string => {
    try {
      const u = new URL(raw);
      u.hash = "";
      return u.href;
    } catch {
      return raw;
    }
  };

  const eq = (a: string, b: string): boolean => normalize(a) === normalize(b);
  const escapedChosen = chosenImage.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const mainHtml = extractMainContentHtml(html);
  const mainHtmlUnescaped = mainHtml.replace(/\\\//g, "/");
  const fullHtmlUnescaped = html.replace(/\\\//g, "/");

  const ogImg = toAbsoluteUrl(getMeta(html, "og:image"), pageUrl);
  if (ogImg && eq(ogImg, chosenImage)) return "og:image";

  const twImg = toAbsoluteUrl(getMeta(html, "twitter:image"), pageUrl);
  if (twImg && eq(twImg, chosenImage)) return "twitter:image";

  if (rssImage) {
    const rssAbs = toAbsoluteUrl(rssImage, pageUrl);
    if (rssAbs && eq(rssAbs, chosenImage)) return "rss:image";
  }

  const imgTagRe = new RegExp(
    `<img[^>]+(?:src|data-src|data-lazy-src)=["'][^"']*${escapedChosen}[^"']*["']`,
    "i",
  );
  if (imgTagRe.test(mainHtml) || imgTagRe.test(mainHtmlUnescaped)) return "img:corpo";

  if (mainHtml.includes(chosenImage) || mainHtmlUnescaped.includes(chosenImage)) {
    return "html:conteudo";
  }

  if (html.includes(chosenImage) || fullHtmlUnescaped.includes(chosenImage)) {
    return "html:pagina";
  }

  if (/glbimg\.com|globo\.com/i.test(chosenImage)) return "cdn:globo-fallback";
  return "desconhecida";
}

function getImages(html: string, pageUrl: string, rssImage?: string): string[] {
  const seen = new Set<string>();
  const imgs: string[] = [];
  const mainHtml = extractMainContentHtml(html);
  const mainHtmlUnescaped = mainHtml.replace(/\\\//g, "/");

  const add = (rawUrl: string): boolean => {
    const url = toAbsoluteUrl(rawUrl, pageUrl);
    if (!url) return false;
    if (isBlockedImage(url)) return false;
    if (seen.has(url)) return false;
    seen.add(url);
    imgs.push(url);
    return true;
  };

  // === Prioridade 1: og:image / twitter:image ===
  const ogImg = getMeta(html, "og:image");
  const twImg = getMeta(html, "twitter:image");
  add(ogImg);
  if (twImg !== ogImg) add(twImg);

  // Se encontrou og:image válida, retorna (é a imagem canônica)
  if (imgs.length > 0) return imgs.slice(0, 1);

  // === Prioridade 2: JSON-LD image ===
  const ldScripts =
    html.match(
      /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ) ?? [];
  for (const s of ldScripts) {
    try {
      const raw = s.replace(/<script[^>]*>|<\/script>/gi, "").trim();
      const json = JSON.parse(raw);
      const items = Array.isArray(json["@graph"]) ? json["@graph"] : [json];
      for (const item of items) {
        const f = (item as Record<string, unknown>).image;
        if (typeof f === "string") add(f);
        else if (f && typeof f === "object") {
          add((f as Record<string, string>).url ?? "");
          add((f as Record<string, string>).contentUrl ?? "");
        }
        // Array de imagens (G1 às vezes usa)
        if (Array.isArray(f)) {
          for (const img of f) {
            if (typeof img === "string") add(img);
            else if (img && typeof img === "object") {
              add((img as Record<string, string>).url ?? "");
            }
          }
        }
      }
    } catch {
      /* ignore */
    }
  }
  if (imgs.length > 0) return imgs.slice(0, 1);

  // === Prioridade 3: <img> dentro do corpo do artigo ===
  const bodyHtml = mainHtml;
  const imgRe = /<img([^>]+)>/gi;
  let m: RegExpExecArray | null;
  while ((m = imgRe.exec(bodyHtml)) !== null) {
    const tag = m[1];
    const src =
      (
        tag.match(/\ssrc=["']([^"']+)["']/) ||
        tag.match(/\sdata-src=["']([^"']+)["']/) ||
        tag.match(/\sdata-lazy-src=["']([^"']+)["']/)
      )?.[1] ?? "";
    if (!src) continue;

    const cls = tag.match(/\sclass=["']([^"']*)["']/)?.[1] ?? "";
    const alt = tag.match(/\salt=["']([^"']*)["']/)?.[1] ?? "";
    if (BLOCKED_IMG_RE.test(cls) || BLOCKED_IMG_RE.test(alt)) continue;

    const w = parseInt(
      tag.match(/\swidth=["'](\d+)["']/)?.[1] ?? "9999",
    );
    const h = parseInt(
      tag.match(/\sheight=["'](\d+)["']/)?.[1] ?? "9999",
    );
    if (w < 250 || h < 80) continue;

    add(src);
    if (imgs.length >= 2) break;
  }

  if (imgs.length > 0) return imgs.slice(0, 1);

  // === Prioridade 4: CDN Globo, mas restrito ao conteúdo principal ===
  // Evita capturar imagem de widgets/recomendados fora do artigo.
  const glbPhotoRe =
    /https?:\/\/(?:s[0-9]+\.glbimg\.com|i\.s3\.glbimg\.com)\/[^"'\s)>]+\.(?:jpe?g|png|webp)/gi;
  for (const u of [
    ...new Set((mainHtml + "\n" + mainHtmlUnescaped).match(glbPhotoRe) ?? []),
  ]) {
    if (add(u) && imgs.length > 0) return imgs.slice(0, 1);
  }

  const g1SmartRe =
    /https?:\/\/s2-g1\.glbimg\.com\/[^"'\s)]+\/smart\/https?:\/\/i\.s3\.glbimg\.com\/v1\/AUTH_[^"'\s)]+\.(?:jpe?g|png|webp)/gi;
  for (const u of [
    ...new Set((mainHtml + "\n" + mainHtmlUnescaped).match(g1SmartRe) ?? []),
  ]) {
    if (add(u) && imgs.length > 0) return imgs.slice(0, 1);
  }

  // === Prioridade 5: RSS image como último recurso ===
  if (imgs.length === 0 && rssImage) add(rssImage);

  return imgs.slice(0, 3);
}

function getG1SmartImages(html: string): string[] {
  const mainHtml = extractMainContentHtml(html);
  const mainHtmlUnescaped = mainHtml.replace(/\\\//g, "/");
  const text = `${mainHtml}\n${mainHtmlUnescaped}`;
  const re =
    /https?:\/\/s2-g1\.glbimg\.com\/[^"'\s)]+\/smart\/https?:\/\/i\.s3\.glbimg\.com\/v1\/AUTH_[^"'\s)]+\.(?:jpe?g|png|webp)/gi;
  const found = [...new Set(text.match(re) ?? [])];
  return found.filter((u) => !isBlockedImage(u));
}

function getBody(html: string): string {
  let text = extractMainContentHtml(html).replace(
    /<(figure)[^>]*>[\s\S]*?<\/\1>/gi,
    " ",
  );
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z#0-9]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 8000);
}

// ─── RSS Parser ───────────────────────────────────────────────────────────────

function parseRSS(xml: string): Candidate[] {
  const items: Candidate[] = [];
  const cleanXml = xml.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");

  const blocks =
    cleanXml.match(/<item[\s>][\s\S]*?<\/item>/gi) ??
    cleanXml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) ??
    [];

  for (const block of blocks) {
    const getText = (tag: string) =>
      block
        .match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"))?.[1]
        ?.trim() ?? "";

    let url = "";
    // <link>https://...</link>
    const m1 = block.match(/<link[^>]*>(https?:\/\/[^<\s]+)<\/link>/i);
    if (m1) url = m1[1].trim();
    // <link/> seguido de URL
    if (!url) {
      const m2 = block.match(/<link\s*\/?>\s*(https?:\/\/[^\s<]+)/i);
      if (m2) url = m2[1].trim();
    }
    // Atom <link href="...">
    if (!url) {
      const m3 =
        block.match(
          /<link[^>]+href=["']([^"']+)["'][^>]*(?:rel=["']alternate["'][^>]*)?\/>/i,
        ) ??
        block.match(
          /<link[^>]+(?:rel=["']alternate["'][^>]+)?href=["']([^"']+)["']/i,
        );
      if (m3) url = m3[1].trim();
    }
    // <guid> com URL
    if (!url) {
      const g = getText("guid");
      if (g.startsWith("http")) url = g.trim();
    }

    const title = decodeEntities(
      getText("title").replace(/<[^>]+>/g, "").trim(),
    );
    const desc = decodeEntities(
      (getText("summary") || getText("description"))
        .replace(/<[^>]+>/g, "")
        .trim(),
    );

    // Busca imagem real (jpg/png/webp) — ignora logos SVG
    const image =
      block.match(/<media:content[^>]+url=["']([^"']+)["']/i)?.[1] ||
      block.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/i)?.[1] ||
      block.match(/<enclosure[^>]+url=["']([^"']+)["']/i)?.[1] ||
      block.match(
        /<img\s[^>]*src=["']([^"']+\.(?:jpe?g|png|webp)[^"']*)["']/i,
      )?.[1] ||
      "";
    const pubDate =
      getText("pubDate") ||
      getText("published") ||
      getText("updated") ||
      getText("dc:date");

    let date = "";
    if (pubDate) {
      try {
        date = new Date(pubDate).toISOString().slice(0, 10);
      } catch {
        /* ignore */
      }
    }

    if (url && isValidUrl(url)) {
      items.push({
        url,
        fonte: "",
        localGV: false,
        rssTitle: title,
        rssDesc: desc,
        rssImage: image || undefined,
        rssDate: date || undefined,
      });
    }
  }
  return items;
}

// ─── URL / Text Filters ───────────────────────────────────────────────────────

const BLOCKED_EXTS_RE =
  /\.(png|jpe?g|gif|webp|svg|ico|js|css|pdf|mp4|mp3|zip|rar|exe|xml|json|woff2?|ttf|eot)(\?.*)?$/i;

// Inclui "localidades" e "canais" do DeFato (páginas de categoria WP)
const BLOCKED_SEGS_RE =
  /\/(feed|rss|category|categoria|tag|wp-admin|wp-content|wp-includes|wp-json|wp-login\.php|author|autor|search|busca|pagina|page|inter-tv|inter-1|inter-2|bom-dia-inter|videos?|canais|arquivo|impressos|guia-defato|guias-de-servico)(?:\/|$)/i;

// Títulos de seções / navegação / não-notícias
const BLOCKED_TITLE_RE =
  /\b(arquivo[s]?|feed|rss|404|edital|editais|expediente|anuncie|publicidade|galeria|programas|promoç[oõ]es)\b|noticias e videos|veja os videos|videos bom dia|assista online|assista .{0,30} no g1|veja os programas|inter tv dos vales|programa:|edicao [0-9]|resumo do dia|ultimas noticias|plantao de noticias/i;

// Cidades da região que NÃO são GV
const OTHER_CITIES_RE =
  /\b(itabira|ipatinga|belo horizonte|caratinga|coronel fabriciano|timoteo|timóteo|manhuacu|manhuaçu|inhapim|muriae|muriaé|ubai|ubaí|teofilo otoni|teófilo otoni|mantena|aimores|aimorés|conselheiro pena|resplendor|galiléia|galileia|periquito|tumiritinga|coroaci|frei inocencio|frei inocêncio|nacip raydan|virgem da lapa|jequitinhonha|diamantina|itueta|nanuque|joao monlevade|joão monlevade|são gonçalo do rio abaixo)\b/i;

const GV_RE = /\b(governador valadares|valadares)\b/i;
const G1_GV_URL_RE = /g1\.globo\.com\/mg\/vales-mg\/(?:noticia|ao-vivo|videos?)\/.*governador-valadares|g1\.globo\.com\/.*\/governador-valadares\//i;
const PERSON_NAME_RE =
  /^[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][a-záéíóúãõâêîôûàèìòùç]+(?: [A-ZÁÉÍÓÚÃÕÂÊÎÔÛÀÈÌÒÙÇ][a-záéíóúãõâêîôûàèìòùç]+){1,2}$/;

// Notícias nacionais sem conexão local
const NATIONAL_RE =
  /\b(stf|supremo tribunal|senado federal|congresso nacional|planalto|brasilia|presidente lula|presidente da republica|selecao brasileira|copa do mundo|flamengo|corinthians|palmeiras|sao paulo fc|vasco|botafogo|fluminense|internacional|gremio|cruzeiro|atletico.mg|santos fc|ancelotti|toffoli|lula|bolsonaro|moraes|barroso|nunes marques|gilmar mendes|fachin)\b/i;

// Conteúdos opinativos/colunas sem hard news local.
const OPINION_RE =
  /\b(coluna|opiniao|opinião|artigo|reflex[aã]o|reflexão|cronic[ao]|editorial|pré-campanha|pre-campanha|deus criador|arquiteto do universo)\b/i;

function isValidUrl(url: string): boolean {
  if (!url.startsWith("http")) return false;
  if (BLOCKED_EXTS_RE.test(url) || BLOCKED_SEGS_RE.test(url) || url.includes("#"))
    return false;

  // DeFato: bloqueia URLs de /localidades/OUTRA-CIDADE/
  const defatoLocalidade = url.match(
    /defatoonline\.com\.br\/localidades\/([^/]+)\//i,
  );
  if (defatoLocalidade) {
    const cidade = defatoLocalidade[1].toLowerCase();
    if (cidade !== "governador-valadares") return false;
  }

  return true;
}

const NON_ARTICLE_URL_RE =
  /\/(arquivos?|arquivo-videos?|expediente|politica-de-privacidade|editais?|contato|quem-somos|sobre|whatsapp)(?:\/|$)|\/(?:noticias|videos?)\/?$/i;

function scoreCandidate(c: Candidate, minDate: string): number {
  let score = 0;
  if (c.fonte === "G1 Vales") score += 70;
  if (c.rssDate) score += 120;
  if (c.rssTitle && c.rssTitle.length >= 25) score += 50;
  if (c.localGV) score += 20;
  if (/\/\d{4}\/\d{2}\/\d{2}\//.test(c.url)) score += 30;
  if (/(governador-valadares|valadares)/i.test(c.url)) score += 25;
  if (NON_ARTICLE_URL_RE.test(c.url)) score -= 250;
  if (c.rssDate && c.rssDate < minDate) score -= 500;
  return score;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function jaccard(a: string, b: string): number {
  const words = (s: string) =>
    new Set(norm(s).split(/\W+/).filter((w) => w.length > 3));
  const wa = words(a),
    wb = words(b);
  if (!wa.size || !wb.size) return 0;
  let inter = 0;
  for (const w of wa) if (wb.has(w)) inter++;
  return inter / (wa.size + wb.size - inter);
}

function inferCategory(text: string): string {
  const t = norm(text);
  if (
    /polici|crimin|preso|apreend|trafic|homicid|assalt|roubo|furto|delegaci|investigac|operacao/.test(t)
  )
    return "policia";
  if (
    /acidente|batida|colisao|capotou|atropel|caminhao|transito|carreta|tombou/.test(t)
  )
    return "acidente";
  if (
    /prefeit|vereador|deputado|senador|eleicao|mandato|camara|municipal|politico/.test(t)
  )
    return "politica";
  if (
    /saude|hospital|ubs|medico|doenca|vacina|dengue|covid|cancer|enfermari|sus/.test(t)
  )
    return "saude";
  if (
    /escola|educacao|universidade|faculdade|aluno|professor|ensino|formatura/.test(t)
  )
    return "educacao";
  if (
    /esporte|futebol|atletico|cruzeiro|campeonato|jogo|time|gol|olimp/.test(t)
  )
    return "esporte";
  if (
    /economia|emprego|empresa|comercio|industria|produto|preco|financ|negocio/.test(t)
  )
    return "economia";
  return "geral";
}

// ─── AI: Reescrita (SOMENTE texto, sem imagem) ───────────────────────────────

type AIResult =
  | {
      ok: true;
      aprovada: boolean;
      motivo: string;
      titulo: string;
      descricao: string;
    }
  | { ok: false; fatal: boolean };

type AIReviewResult =
  | {
      ok: true;
      aprovada: boolean;
      motivo: string;
    }
  | { ok: false; fatal: boolean };

async function reviewRelevanceWithAI(
  fonte: string,
  titulo: string,
  ogDesc: string,
  body: string,
  apiKey: string,
  log: LogFn,
): Promise<AIReviewResult> {
  const prompt = `Você é um CURADOR de notícias locais de Governador Valadares (MG).
Decida se a matéria deve entrar no feed local.

FONTE: ${fonte}
TÍTULO: ${titulo}
RESUMO: ${ogDesc.slice(0, 600)}
CORPO: ${body.slice(0, 2200)}

APROVAR (aprovada=true) somente se houver relação direta com Governador Valadares:
- fato ocorrido em GV;
- serviço público, órgão, bairro, instituição, empresa, evento ou impacto concreto em GV.

REPROVAR (aprovada=false) quando:
- coluna/opinião/reflexão sem fato local concreto;
- marketing pessoal, publieditorial, conteúdo social;
- notícia nacional/internacional sem impacto local claro em GV;
- notícia de outra cidade sem conexão real com GV.

Responda SOMENTE JSON válido:
{"aprovada": true/false, "motivo": "breve"}`
;

  const t0 = Date.now();
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
        max_tokens: 250,
        temperature: 0.1,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    25_000,
  );

  const elapsed = Date.now() - t0;
  if (!resp) {
    log(`  ⚠️ [Agente GV] timeout (${elapsed}ms)`, "warn");
    return { ok: false, fatal: false };
  }
  if (!resp.ok) {
    let errMsg = `HTTP ${resp.status}`;
    let isFatal = false;
    try {
      const errBody = await resp.json();
      errMsg += `: ${JSON.stringify(errBody)}`;
      const msg: string = errBody?.error?.message ?? "";
      if (
        msg.includes("quota") ||
        msg.includes("billing") ||
        resp.status === 401 ||
        resp.status === 403
      ) {
        isFatal = true;
      }
    } catch {
      /* ignore */
    }
    log(`  ⚠️ [Agente GV] ${errMsg}`, "warn");
    return { ok: false, fatal: isFatal };
  }

  try {
    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const match = text.match(/\{[\s\S]*?"aprovada"[\s\S]*?"motivo"[\s\S]*?\}/);
    if (!match) return { ok: false, fatal: false };
    const parsed = JSON.parse(match[0]);
    if (
      typeof parsed.aprovada === "boolean" &&
      typeof parsed.motivo === "string"
    ) {
      return {
        ok: true,
        aprovada: parsed.aprovada,
        motivo: parsed.motivo.slice(0, 180),
      };
    }
  } catch {
    /* ignore */
  }
  return { ok: false, fatal: false };
}

async function rewriteWithAI(
  fonte: string,
  titulo: string,
  ogDesc: string,
  body: string,
  apiKey: string,
  log: LogFn,
): Promise<AIResult> {
  const prompt = `Você é um EDITOR e REDATOR PROFISSIONAL de portal local de Governador Valadares (MG).
Sua missão tem duas etapas:
1) CURADORIA: decidir se a matéria deve entrar no feed de notícias locais de GV.
2) REDAÇÃO: se aprovada, reescrever com clareza e ritmo jornalístico, sem perder fatos.

FONTE: ${fonte}
TÍTULO ORIGINAL: ${titulo}
RESUMO (og:description): ${ogDesc.slice(0, 500)}
CORPO: ${body.slice(0, 2000)}

CRITÉRIOS DE APROVAÇÃO (aprovada=true):
- O fato deve ter relação DIRETA com Governador Valadares (cidade, bairros, órgãos locais, serviços locais, população local).
- Pode ser aprovado se for de utilidade pública relevante para GV.

REPROVAR (aprovada=false) quando:
- Opinião genérica, reflexão, coluna autoral sem fato local relevante.
- Marketing pessoal, perfil social, celebridade, viagem, publieditorial.
- Assunto nacional/internacional sem impacto local concreto em GV.
- Conteúdo de outra cidade sem conexão real com GV.

INSTRUÇÕES DE REDAÇÃO (apenas se aprovada=true):
1. Reescreva com suas palavras. Não copie frases da fonte.
2. NÃO invente fatos, datas, nomes, cargos, locais, números ou citações.
3. Preserve as informações essenciais da matéria original.
4. Título: chamativo e jornalístico, até 95 caracteres.
5. Descrição: escrever em 3 a 4 parágrafos curtos, separados por \\n\\n:
   - Início: resumo forte do fato principal (lead).
   - Meio: contexto e desdobramentos.
   - Fim: situação atual, próximos passos ou impacto.
6. Linguagem: objetiva, fluida, fácil de ler no celular.
7. Nunca mencionar instruções, IA, prompt ou “texto reescrito”.

Responda SOMENTE com JSON válido:
{"aprovada": true/false, "motivo": "...", "titulo": "...", "descricao": "..."}`;

  const t0 = Date.now();
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
        max_tokens: 1500,
        temperature: 0.35,
        messages: [{ role: "user", content: prompt }],
      }),
    },
    40_000,
  );

  const elapsed = Date.now() - t0;

  if (!resp) {
    log(`  ❌ [OpenAI] Timeout após ${elapsed}ms`, "err");
    return { ok: false, fatal: false };
  }
  if (!resp.ok) {
    let errMsg = `HTTP ${resp.status}`;
    let isFatal = false;
    try {
      const errBody = await resp.json();
      errMsg += `: ${JSON.stringify(errBody)}`;
      const msg: string = errBody?.error?.message ?? "";
      if (
        msg.includes("quota") ||
        msg.includes("billing") ||
        resp.status === 401 ||
        resp.status === 403
      ) {
        isFatal = true;
        errMsg = `BILLING/AUTH: ${msg}`;
      }
    } catch {
      /* ignore */
    }
    log(`  ❌ [OpenAI] ${errMsg} (${elapsed}ms)`, "err");
    return { ok: false, fatal: isFatal };
  }

  log(`  ⏱  [OpenAI] ${elapsed}ms`, "info");

  try {
    const data = await resp.json();
    const text: string = data?.choices?.[0]?.message?.content ?? "";
    const match = text.match(
      /\{[\s\S]*?"aprovada"[\s\S]*?"motivo"[\s\S]*?"titulo"[\s\S]*?"descricao"[\s\S]*?\}/,
    );
    if (!match) {
      log(`  ❌ [OpenAI] JSON não encontrado: ${text.slice(0, 200)}`, "err");
      return { ok: false, fatal: false };
    }
    const parsed = JSON.parse(match[0]);
    if (
      typeof parsed.aprovada === "boolean" &&
      typeof parsed.motivo === "string" &&
      typeof parsed.titulo === "string" &&
      typeof parsed.descricao === "string"
    ) {
      return {
        ok: true,
        aprovada: parsed.aprovada,
        motivo: parsed.motivo.slice(0, 220),
        titulo: parsed.titulo.slice(0, 100),
        descricao: parsed.descricao,
      };
    }
    log(`  ❌ [OpenAI] JSON inválido — campos ausentes`, "err");
  } catch (e) {
    log(`  ❌ [OpenAI] Erro parse: ${e}`, "err");
  }
  return { ok: false, fatal: false };
}

// ─── Image Validation (HEAD request) ──────────────────────────────────────────

async function validateImage(url: string, log?: LogFn): Promise<boolean> {
  if (isBlockedImage(url)) return false;

  const isValidHeaders = (resp: Response | null): boolean => {
    if (!resp?.ok) return false;
    const ct = resp.headers.get("content-type") ?? "";
    if (!ct.startsWith("image/") || ct.includes("svg") || ct.includes("gif")) {
      return false;
    }
    const size = parseInt(resp.headers.get("content-length") ?? "0");
    if (size > 0 && size < 10_000) return false;
    return true;
  };

  const head = await fetchSafe(url, { method: "HEAD" }, 7_000);
  if (isValidHeaders(head)) return true;

  const get = await fetchSafe(
    url,
    {
      method: "GET",
      headers: { Range: "bytes=0-2048" },
    },
    10_000,
  );
  if (isValidHeaders(get)) return true;

  const status = head?.status ?? get?.status ?? "timeout";
  log?.(`    ⛔ Imagem inválida (${status}): ${url.slice(-60)}`, "warn");
  return false;
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
      if (!seen.has(url)) {
        seen.add(url);
        links.push(url);
      }
    } catch {
      /* ignore */
    }
  }
  return links;
}

async function loadFontesConfiguradas(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  cidadeId: string,
  log: LogFn,
): Promise<FonteConfig[]> {
  const { data, error } = await supabase
    .from("cidade_scraping_fonte")
    .select("nome, tipo, url, local_gv, ativo, ordem")
    .eq("cidade_id", cidadeId)
    .eq("ativo", true)
    .order("ordem", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    log(`⚠️ Falha ao carregar fontes dinâmicas: ${error.message}`, "warn");
    return DEFAULT_FONTES;
  }

  const mapped: FonteConfig[] = (data ?? [])
    .map((row: any) => ({
      nome: String(row.nome ?? "").trim(),
      tipo: row.tipo === "rss" ? "rss" : "html",
      url: String(row.url ?? "").trim(),
      localGV: row.local_gv === true,
    }))
    .filter((f) => f.nome && f.url);

  if (mapped.length === 0) {
    log("⚠️ Nenhuma fonte ativa no banco; usando fontes padrão", "warn");
    return DEFAULT_FONTES;
  }

  return mapped;
}

// ─── Core Scraping Logic ──────────────────────────────────────────────────────

async function runScraping(opts: {
  cidadeId: string;
  lookbackDays: number;
  testMode: boolean;
  debugMode: boolean;
  rewriteAiEnabled: boolean;
  validateAiEnabled: boolean;
  maxArticles: number;
  anthropicKey: string;
  log: LogFn;
  // deno-lint-ignore no-explicit-any
  supabase: any;
}): Promise<Stats> {
  const {
    cidadeId,
    lookbackDays,
    testMode,
    debugMode,
    rewriteAiEnabled,
    validateAiEnabled,
    maxArticles,
    anthropicKey,
    log,
    supabase,
  } = opts;
  const today = todayBRT();
  const minDate = minDateBRT(lookbackDays);

  const isOpenAI = !!Deno.env.get("OPENAI_API_KEY");
  if (anthropicKey && (rewriteAiEnabled || validateAiEnabled)) {
    log(
      `🔑 ${isOpenAI ? "OpenAI" : "Anthropic"} API key (${anthropicKey.length} chars, ${anthropicKey.slice(0, 12)}...)`,
      "info",
    );
    log(
      `🤖 IA revisão GV: ${validateAiEnabled ? "ATIVA" : "DESATIVADA"} | IA reescrita: ${rewriteAiEnabled ? "ATIVA" : "DESATIVADA"}`,
      "info",
    );
  } else {
    log(`⚠️  IA desativada — usando texto original`, "warn");
  }
  log(
    `📅 Hoje: ${today} | Min: ${minDate} | Modo: ${testMode ? "TESTE" : "NORMAL"} | Limite: ${maxArticles}`,
  );

  const stats: Stats = {
    data_processada: today.split("-").reverse().join("/"),
    modo: testMode
      ? "TESTE"
      : anthropicKey && (rewriteAiEnabled || validateAiEnabled)
        ? `NORMAL + ${isOpenAI ? "OpenAI" : "Claude"} (${validateAiEnabled ? "filtro GV" : "sem filtro GV"}${rewriteAiEnabled ? ", reescrita" : ""})`
        : "NORMAL",
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
  const insertedNews: InsertedNews[] = [];

  function reject(url: string, titulo: string | undefined, motivo: string) {
    if (debugMode) stats.debug!.push({ url, titulo, motivo });
  }

  // Dedup: janela de busca configurada
  const sevenDaysAgo = new Date(Date.now() - lookbackDays * 86_400_000).toISOString();
  const { data: existing } = await supabase
    .from("rel_cidade_jornal")
    .select("id_externo, titulo")
    .eq("cidade_id", cidadeId)
    .gte("created_at", sevenDaysAgo);

  const existingUrls = new Set<string>(
    (existing ?? [])
      .map((r: { id_externo: string }) => r.id_externo)
      .filter(Boolean),
  );
  const existingTitles: string[] = (existing ?? [])
    .map((r: { titulo: string }) => r.titulo)
    .filter(Boolean);

  // ═══ Step 1: Collect candidates ═══════════════════════════════════════════

  const candidates: Candidate[] = [];
  const fontesConfiguradas = await loadFontesConfiguradas(supabase, cidadeId, log);
  log(`🧩 Fontes ativas carregadas: ${fontesConfiguradas.length}`, "info");

  await Promise.all(
    fontesConfiguradas.map(async (fonte) => {
      log(`🔍 ${fonte.nome}...`);
      const resp = await fetchSafe(fonte.url, {}, 20_000);
      if (!resp?.ok) {
        stats.erros.push(`${fonte.nome}: HTTP ${resp?.status ?? "timeout"}`);
        log(`  ❌ ${fonte.nome}: falha (${resp?.status ?? "timeout"})`, "err");
        return;
      }
      const text = await resp.text();
      const found: Candidate[] = [];
      if (fonte.tipo === "rss") {
        const parsed = parseRSS(text);
        if (parsed.length === 0) {
          log(
            `  🔎 RSS vazio. Preview: ${text.slice(0, 200).replace(/\s+/g, " ")}`,
            "warn",
          );
        }
        for (const item of parsed)
          found.push({ ...item, fonte: fonte.nome, localGV: fonte.localGV });
      } else {
        for (const link of extractArticleLinks(text, fonte.url))
          found.push({ url: link, fonte: fonte.nome, localGV: fonte.localGV });
      }
      log(`  ✅ ${fonte.nome}: ${found.length} links`, "ok");
      candidates.push(...found);
    }),
  );

  // Dedup candidatos
  const seenCandidates = new Set<string>();
  const unique = candidates.filter((c) => {
    if (seenCandidates.has(c.url)) return false;
    seenCandidates.add(c.url);
    return true;
  });
  log(`📊 ${candidates.length} candidatos → ${unique.length} únicos`);

  // ═══ Step 2: Pre-filter ═══════════════════════════════════════════════════

  const toProcess: Candidate[] = [];
  for (const c of unique) {
    if (!isValidUrl(c.url)) {
      stats.urls_invalidas++;
      reject(c.url, c.rssTitle, "URL inválida");
      continue;
    }
    if (NON_ARTICLE_URL_RE.test(c.url)) {
      stats.urls_invalidas++;
      reject(c.url, c.rssTitle, "URL de navegação/arquivo");
      continue;
    }
    if (existingUrls.has(c.url)) {
      stats.duplicadas_url++;
      reject(c.url, c.rssTitle, "URL duplicada");
      continue;
    }
    if (!testMode && c.rssDate && c.rssDate < minDate) {
      stats.antigas_rejeitadas++;
      reject(c.url, c.rssTitle, `Data RSS: ${c.rssDate}`);
      continue;
    }
    toProcess.push(c);
  }
  const ranked = [...toProcess].sort(
    (a, b) => scoreCandidate(b, minDate) - scoreCandidate(a, minDate),
  );
  const scanLimit = Math.min(ranked.length, Math.max(maxArticles * 3, maxArticles));
  const queue = ranked.slice(0, Math.max(1, scanLimit));
  log(
    `⚙️  ${toProcess.length} elegíveis | varrendo ${queue.length} candidatos (meta: até ${maxArticles} notícias)`,
  );

  // Flag para desabilitar IA após erro fatal
  const canUseAI = rewriteAiEnabled && !!anthropicKey;
  const canUseAIReviewer = validateAiEnabled && !!anthropicKey;
  let aiDisabled = false;
  let aiReviewerDisabled = false;

  // ═══ Step 3: Process articles ═════════════════════════════════════════════

  async function processArticle(
    candidate: Candidate,
    index: number,
    total: number,
  ): Promise<void> {
    if (stats.inseridas >= maxArticles) return;
    const { url, fonte, localGV, rssTitle, rssDesc, rssImage, rssDate } =
      candidate;
    log(`\n🧭 [${index}/${total}] ${fonte}`, "info");
    log(`📰 notícia ${index} encontrada`, "info");
    log(`  🔗 notícia: ${url}`, "info");
    log(`  step 1/5: buscar notícia`, "info");

    // Recheca dedup no momento da execução (modo sequencial, mas robusto).
    if (existingUrls.has(url)) {
      stats.duplicadas_url++;
      reject(url, rssTitle, "URL duplicada (recheck)");
      log(`  ✗ [dup url] já existe no banco`, "warn");
      return;
    }

    // ── Fetch page ──
    const resp = await fetchSafe(url, {}, 15_000);
    if (!resp?.ok) {
      stats.erros.push(`${url}: HTTP ${resp?.status ?? "timeout"}`);
      return;
    }
    const html = await resp.text();
    log(`✅ notícia ${index} carregada`, "ok");

    // ── Extract metadata ──
    const titulo = getTitle(html) || rssTitle || "";
    const ogDesc = getOgDesc(html) || rssDesc || "";
    const body = getBody(html);
    const pubDate = getPublishedDate(html) || rssDate || "";
    const short = titulo.length > 55 ? titulo.slice(0, 55) + "…" : titulo;
    log(`  step 2/5: verificar duplicidade e qualidade`, "info");

    // ── Filters ──
    if (titulo.length < 15) {
      stats.urls_invalidas++;
      reject(url, titulo, "Título curto");
      log(`  ✗ [curto] ${short}`, "warn");
      return;
    }
    if (BLOCKED_TITLE_RE.test(titulo)) {
      stats.urls_invalidas++;
      reject(url, titulo, "Título bloqueado");
      log(`  ✗ [bloqueado] ${short}`, "warn");
      return;
    }
    if (OPINION_RE.test(norm(titulo)) && !GV_RE.test(norm(`${titulo} ${ogDesc}`))) {
      stats.urls_invalidas++;
      reject(url, titulo, "Coluna/opinião sem hard news local");
      log(`  ✗ [opinião] ${short}`, "warn");
      return;
    }
    if (PERSON_NAME_RE.test(titulo.trim())) {
      stats.urls_invalidas++;
      reject(url, titulo, "Nome de pessoa");
      log(`  ✗ [nome] ${short}`, "warn");
      return;
    }
    if (!testMode && pubDate && pubDate < minDate) {
      stats.antigas_rejeitadas++;
      reject(url, titulo, `Data: ${pubDate}`);
      log(`  ✗ [antiga ${pubDate}] ${short}`, "warn");
      return;
    }
    if (ogDesc.length < 60 && body.length < 100) {
      stats.sem_conteudo++;
      reject(url, titulo, "Conteúdo insuficiente");
      log(`  ✗ [sem conteúdo] ${short}`, "warn");
      return;
    }

    // ── Filtro de cidade ──
    const cityText = norm(`${titulo} ${ogDesc.slice(0, 200)}`);
    if (OTHER_CITIES_RE.test(cityText) && !GV_RE.test(norm(titulo))) {
      stats.urls_invalidas++;
      reject(url, titulo, "Outra cidade");
      log(`  ✗ [outra cidade] ${short}`, "warn");
      return;
    }

    // ── Filtro de relevância geográfica ──
    const relText = norm(`${titulo} ${ogDesc} ${body.slice(0, 400)}`);
    const isG1 = fonte === "G1 Vales";
    if (localGV) {
      if (NATIONAL_RE.test(relText) && !GV_RE.test(relText)) {
        stats.urls_invalidas++;
        reject(url, titulo, "Nacional sem conexão local");
        log(`  ✗ [nacional] ${short}`, "warn");
        return;
      }
    } else {
      if (isG1 && G1_GV_URL_RE.test(url)) {
        // Para G1, URL de GV é sinal forte de relevância local.
      } else
      if (!GV_RE.test(relText)) {
        stats.urls_invalidas++;
        reject(url, titulo, "Não menciona Valadares");
        log(`  ✗ [irrelevante] ${short}`, "warn");
        return;
      }
    }

    // ── Dedup por título ──
    if (existingTitles.some((t) => jaccard(t, titulo) > 0.8)) {
      stats.duplicadas_titulo++;
      reject(url, titulo, "Título duplicado (Jaccard)");
      log(`  ✗ [dup título] ${short}`, "warn");
      return;
    }

    // Agente IA: valida se a matéria é realmente pertinente a GV.
    if (canUseAIReviewer && !aiReviewerDisabled) {
      const review = await reviewRelevanceWithAI(
        fonte,
        titulo,
        ogDesc,
        body,
        anthropicKey,
        log,
      );
      if (review.ok && !review.aprovada) {
        stats.urls_invalidas++;
        reject(url, titulo, `Agente GV rejeitou: ${review.motivo}`);
        log(`  ✗ [agente gv] ${short} — ${review.motivo}`, "warn");
        return;
      }
      if (!review.ok && review.fatal) {
        aiReviewerDisabled = true;
        log(`  🚫 Agente GV desabilitado (erro fatal de IA)`, "err");
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // IMAGEM: extraída por regex, NUNCA pela IA
    // ══════════════════════════════════════════════════════════════════════
    log(`🖼 pegando imagem da notícia ${index}`, "info");
    log(`  step 3/5: pegar imagem`, "info");
    let rawImages = getImages(html, url, rssImage);
    if (fonte === "G1 Vales" && rawImages.length === 0) {
      const g1Smart = getG1SmartImages(html);
      if (g1Smart.length > 0) {
        rawImages = g1Smart;
        log(`  🖼 fallback G1 smart: ${g1Smart[0].slice(0, 120)}`, "info");
      }
    }

    const validImages: string[] = [];
    for (const img of rawImages.slice(0, 8)) {
      if (await validateImage(img, log)) {
        validImages.push(img);
        if (validImages.length >= 3) break;
      }
    }

    if (validImages.length === 0) {
      stats.sem_imagens_validas++;
      reject(url, titulo, "Sem imagens válidas");
      log(`  ✗ [sem imagem] ${short}`, "warn");
      return;
    }

    const imgHost = (() => {
      try {
        return new URL(validImages[0]).hostname;
      } catch {
        return "?";
      }
    })();
    const chosenImage = validImages[0];
    const imageOrigin = detectImageOrigin(html, url, rssImage, chosenImage);
    if (imageOrigin === "html:pagina" || imageOrigin === "desconhecida") {
      stats.sem_imagens_validas++;
      reject(url, titulo, `Origem de imagem insegura: ${imageOrigin}`);
      log(`  ✗ [sem imagem] origem insegura (${imageOrigin})`, "warn");
      return;
    }
    log(`  🖼 origem: ${imageOrigin} | host: ${imgHost}`, "info");
    log(`  🔗 notícia: ${url}`, "info");
    log(`  🔗 imagem: ${chosenImage}`, "info");

    // ══════════════════════════════════════════════════════════════════════
    // REESCRITA com IA (somente texto)
    // ══════════════════════════════════════════════════════════════════════
    let finalTitulo = titulo;
    let finalDescricao = body.length >= 200 ? body : ogDesc;

    log(`✍️ reescrevendo notícia ${index}`, "info");
    log(`  step 4/5: redigir`, "info");
    if (canUseAI && !aiDisabled) {
      log(`  🤖 Reescrevendo: ${short}`);
      const result = await rewriteWithAI(
        fonte,
        titulo,
        ogDesc,
        body,
        anthropicKey,
        log,
      );
      if (result.ok) {
        if (!result.aprovada) {
          stats.urls_invalidas++;
          reject(url, titulo, `IA rejeitou: ${result.motivo}`);
          log(`  ✗ [ia filtro] ${short} — ${result.motivo}`, "warn");
          return;
        }
        finalTitulo = result.titulo;
        finalDescricao = result.descricao;
        log(`  ✅ IA: ${result.titulo.slice(0, 50)}`, "ok");
      } else if (result.fatal) {
        aiDisabled = true;
        log(`  🚫 IA desabilitada (erro fatal)`, "err");
      } else {
        log(`  ⚠️  IA falhou, usando original`, "warn");
      }
    }

    // ══════════════════════════════════════════════════════════════════════
    // INSERT no Supabase
    // ══════════════════════════════════════════════════════════════════════
    log(`📤 postando notícia ${index}`, "info");
    log(`  step 5/5: postar`, "info");
    const { data: insertedRow, error } = await supabase
      .from("rel_cidade_jornal")
      .insert({
        cidade_id: cidadeId,
        titulo: finalTitulo,
        descricao: finalDescricao,
        descricao_curta: ogDesc.slice(0, 300) || body.slice(0, 300),
        data_noticia: pubDate || null,
        fonte,
        imagens: validImages,
        id_externo: url,
        categoria: inferCategory(`${finalTitulo} ${finalDescricao}`),
      })
      .select("id")
      .single();

    if (error) {
      stats.erros.push(`insert: ${error.message}`);
      log(`  ✗ [db] ${short}: ${error.message}`, "err");
    } else {
      stats.inseridas++;
      existingUrls.add(url);
      existingTitles.push(finalTitulo);
      insertedNews.push({ titulo: finalTitulo, fonte });
      log(`✅ notícia ${index} postada`, "ok");
      if (insertedRow?.id) {
        await triggerJornalAudioGeneration(insertedRow.id, log);
      } else {
        log(`  ⚠️ áudio não acionado: id ausente após insert`, "warn");
      }
      log(`  ✓ Inserido: ${short}`, "ok");
    }
  }

  // Processamento estritamente sequencial: 1 notícia por vez.
  for (let i = 0; i < queue.length; i++) {
    if (stats.inseridas >= maxArticles) break;
    await processArticle(queue[i], i + 1, queue.length);
    if (i < queue.length - 1 && stats.inseridas < maxArticles) {
      log(`➡️ próxima notícia`, "info");
    }
  }
  if (stats.inseridas >= maxArticles) {
    log(`✅ Meta atingida: ${maxArticles} notícia(s) inserida(s)`, "ok");
  }

  stats.erros = stats.erros.slice(0, 20);
  log(`\n📌 Resumo final de inserções`, "ok");
  log(`➕ Notícias adicionadas: ${insertedNews.length}`, "ok");
  if (insertedNews.length === 0) {
    log(`- Nenhuma notícia nova inserida neste lote`, "warn");
  } else {
    for (const item of insertedNews) {
      log(`- [${item.fonte}] ${item.titulo}`, "info");
    }
  }
  log(
    `\n🏁 Concluído! ${stats.inseridas} inserida(s) | ${stats.antigas_rejeitadas} antigas | ${stats.duplicadas_url + stats.duplicadas_titulo} dup | ${stats.sem_imagens_validas} sem imagem`,
    "ok",
  );
  return stats;
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let params: {
    cidade_id?: string;
    test_mode?: boolean;
    debug?: boolean;
    stream?: boolean;
    rewrite_ai?: boolean;
    validate_ai?: boolean;
    lookback_days?: number;
    auto_mode?: boolean;
    max_articles?: number;
  } = {};
  try {
    params = await req.json();
  } catch {
    /* no body */
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const anthropicKey =
    Deno.env.get("OPENAI_API_KEY") ?? Deno.env.get("ANTHROPIC_API_KEY") ?? "";
  const testMode = params.test_mode === true;
  const debugMode = params.debug === true;
  const streamMode = params.stream === true;
  const autoMode = params.auto_mode === true;
  const cidadeId = params.cidade_id ?? DEFAULT_CIDADE_ID;
  const rewriteAiEnabled = params.rewrite_ai === true;
  const validateAiEnabled = params.validate_ai !== false;
  const lookbackDays = Math.min(
    Math.max(params.lookback_days ?? LOOKBACK_DAYS_DEFAULT, 1),
    30,
  );
  const maxArticles = Math.min(
    Math.max(params.max_articles ?? MAX_ARTICLES_DEFAULT, 10),
    120,
  );

  // ── Streaming mode (SSE) ──
  if (streamMode) {
    const enc = new TextEncoder();
    const { readable, writable } =
      new TransformStream<Uint8Array, Uint8Array>();
    const writer = writable.getWriter();

    const send = (data: object) => {
      writer
        .write(enc.encode(`data: ${JSON.stringify(data)}\n\n`))
        .catch(() => {});
    };

    const log: LogFn = (msg, kind = "info") =>
      send({ type: "log", msg, kind });

    (async () => {
      try {
        const stats = await runScraping({
          cidadeId,
          lookbackDays,
          testMode,
          debugMode,
          rewriteAiEnabled,
          validateAiEnabled,
          maxArticles,
          anthropicKey,
          log: (msg, kind) => {
            if (!autoMode) log(msg, kind);
          },
          supabase,
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

  // ── Normal mode (JSON) ──
  try {
    const stats = await runScraping({
      cidadeId,
      lookbackDays,
      testMode,
      debugMode,
      rewriteAiEnabled,
      validateAiEnabled,
      maxArticles,
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
