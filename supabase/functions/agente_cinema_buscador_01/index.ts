import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BROWSER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
  "Cache-Control": "no-cache",
};

interface RequestBody {
  cidade_id: string;
  sites?: string[];
  max_filmes?: number;
  lookback_dias?: number;
}

interface FonteCinema {
  id: string;
  nome: string;
  url: string;
  tipo: "rss" | "html" | "auto";
  ativo: boolean;
}

interface FilmeExtraido {
  titulo: string;
  sinopse: string | null;
  genero: string | null;
  duracao: string | null;
  classificacao: string | null;
  idioma: string | null;
  data_estreia: string | null;
  poster_url: string | null;
  trailer_url: string | null;
  horarios: string[];
  dias_exibicao: string[];
  situacao_exibicao: "em_cartaz" | "em_breve" | "pre_venda" | "desconhecido";
  url_origem: string | null;
  dados_brutos: Record<string, unknown>;
}

interface ExtraMovieMeta {
  genero: string | null;
  duracao: string | null;
  data_estreia: string | null;
  classificacao: string | null;
  poster_url: string | null;
  trailer_url: string | null;
}

const GENERIC_TITLES = new Set<string>([
  "comprar",
  "ver origem",
  "em cartaz",
  "pre venda",
  "em breve",
  "cinemas",
  "institucional",
  "corporativo",
  "bahia",
  "espirito santo",
  "minas gerais",
  "paraiba",
  "rio de janeiro",
  "sergipe",
  "sao paulo",
]);

const BLOCKED_URL_PARTS = [
  "/institucional",
  "/corporativo",
  "/contato",
  "/politica",
  "/privacidade",
  "/termos",
  "/faq",
  "/trabalhe-conosco",
  "/quem-somos",
  "/cidade",
  "/cidades",
  "/estado",
  "/estados",
  "/ingresso",
  "/ingressos",
  "/comprar",
  "/shopping",
];

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

const decodeEntities = (raw: string) =>
  raw
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const stripHtml = (raw: string) =>
  decodeEntities(raw)
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeHorario = (value: string): string | null => {
  const v = value.trim();
  const hm = v.match(/^([01]?\d|2[0-3])[:h]([0-5]\d)$/i);
  if (hm) {
    const h = hm[1].padStart(2, "0");
    const m = hm[2];
    return `${h}:${m}`;
  }
  const iso = v.match(/T([01]\d|2[0-3]):([0-5]\d)/);
  if (iso) return `${iso[1]}:${iso[2]}`;
  return null;
};

const dedupeHorarios = (values: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const normalized = normalizeHorario(raw);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out.sort();
};

const normalizeDia = (value: string): string | null => {
  const v = value.trim();
  const compact = v.match(/^(\d{2})(\d{2})(\d{4})$/);
  if (compact) return `${compact[3]}-${compact[2]}-${compact[1]}`;
  const iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
};

const dedupeDias = (values: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of values) {
    const normalized = normalizeDia(raw);
    if (!normalized) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out.sort();
};

const asArray = <T>(value: T | T[] | null | undefined): T[] => {
  if (Array.isArray(value)) return value;
  if (value == null) return [];
  return [value];
};

const firstString = (...values: Array<unknown>): string | null => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
};

const getImageFromUnknown = (value: unknown): string | null => {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const img = getImageFromUnknown(item);
      if (img) return img;
    }
  }
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const img = firstString(obj.url, obj.contentUrl, obj.thumbnailUrl);
    if (img) return img;
  }
  return null;
};

const normalizeUrl = (raw: string, baseUrl?: string): string | null => {
  try {
    const u = baseUrl ? new URL(raw, baseUrl) : new URL(raw);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
};

const hashDjb2 = (value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

const fetchHtml = async (url: string): Promise<string | null> => {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: BROWSER_HEADERS,
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
};

const isLikelyGenericTitle = (title: string): boolean => {
  const norm = normalizeText(title);
  if (!norm || norm.length < 3) return true;
  if (GENERIC_TITLES.has(norm)) return true;
  if (/^(ver|saiba|clique|acesse)\b/.test(norm)) return true;
  if (/^(bahia|espirito santo|minas gerais|paraiba|rio de janeiro|sergipe|sao paulo)$/.test(norm)) {
    return true;
  }
  return false;
};

const isLikelyMovieUrl = (url: string): boolean => {
  const lower = url.toLowerCase();
  if (BLOCKED_URL_PARTS.some((part) => lower.includes(part))) return false;
  return /\/filme(s)?(\/|$)|\/movie(s)?(\/|$)|\/cartaz(\/|$)|\/programacao\/filmes(\/|$)|[?&](filme|movie)=/i.test(
    lower,
  );
};

const extractMeta = (html: string, key: string, attr: "property" | "name" = "property"): string | null => {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i");
  const match = html.match(re);
  return match?.[1] ? stripHtml(match[1]) : null;
};

const isBadPosterUrl = (url: string | null): boolean => {
  if (!url) return true;
  const low = url.toLowerCase();
  return (
    low.includes("favicon") ||
    low.includes("/logo") ||
    low.includes("site-logo") ||
    low.includes("/icons/")
  );
};

const extractPosterFromHtml = (html: string, baseUrl?: string): string | null => {
  const candidates: string[] = [];

  for (const m of html.matchAll(/<img[^>]+class=["'][^"']*(?:filme-poster|poster-img)[^"']*["'][^>]+src=["']([^"']+)["']/gi)) {
    if (m[1]) candidates.push(m[1]);
  }
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']*\/fotos\/filmes\/poster\/[^"']+)["']/gi)) {
    if (m[1]) candidates.push(m[1]);
  }
  for (const m of html.matchAll(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/gi)) {
    if (m[1]) candidates.push(m[1]);
  }

  for (const candidate of candidates) {
    const normalized = normalizeUrl(candidate, baseUrl);
    if (!normalized || isBadPosterUrl(normalized)) continue;
    return normalized;
  }

  return null;
};

const normalizeYouTubeUrl = (raw: string | null | undefined): string | null => {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  if (/^[a-zA-Z0-9_-]{8,15}$/.test(value)) {
    return `https://www.youtube.com/watch?v=${value}`;
  }

  const normalized = normalizeUrl(value);
  if (!normalized) return null;

  try {
    const u = new URL(normalized);
    const host = u.hostname.toLowerCase();
    if (host.includes("youtube.com")) {
      if (u.pathname.startsWith("/watch")) {
        const v = u.searchParams.get("v");
        if (v) return `https://www.youtube.com/watch?v=${v}`;
      }
      if (u.pathname.startsWith("/embed/")) {
        const id = u.pathname.split("/embed/")[1]?.split(/[/?#]/)[0];
        if (id) return `https://www.youtube.com/watch?v=${id}`;
      }
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/shorts/")[1]?.split(/[/?#]/)[0];
        if (id) return `https://www.youtube.com/watch?v=${id}`;
      }
    }
    if (host.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").split(/[/?#]/)[0];
      if (id) return `https://www.youtube.com/watch?v=${id}`;
    }
  } catch {
    return null;
  }

  return null;
};

const extractTrailerFromHtml = (html: string): string | null => {
  const direct = html.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)[a-zA-Z0-9_?=&\-\/]+/i)?.[0];
  const directNorm = normalizeYouTubeUrl(direct);
  if (directNorm) return directNorm;

  const embed = html.match(/<iframe[^>]+src=["']([^"']*(?:youtube\.com|youtu\.be)[^"']+)["']/i)?.[1];
  const embedNorm = normalizeYouTubeUrl(embed);
  if (embedNorm) return embedNorm;

  const onclickId = html.match(/trailer\s*\(\s*['"]([a-zA-Z0-9_-]{8,15})['"]/i)?.[1];
  const onclickNorm = normalizeYouTubeUrl(onclickId);
  if (onclickNorm) return onclickNorm;

  return null;
};

const extractMovieMetaFromHtml = (html: string): ExtraMovieMeta => {
  const result: ExtraMovieMeta = {
    genero: null,
    duracao: null,
    data_estreia: null,
    classificacao: null,
    poster_url: null,
    trailer_url: null,
  };

  const duracaoLabel = html.match(/<b>\s*Dura(?:ç|c)[aã]o:\s*<\/b>\s*([\s\S]{1,80}?)(?:<\/p>|<br|<div)/i)?.[1];
  if (duracaoLabel) result.duracao = stripHtml(duracaoLabel);

  const generoLabel = html.match(/<b>\s*G(?:ê|e)nero:\s*<\/b>\s*([\s\S]{1,120}?)(?:<\/p>|<br|<div)/i)?.[1];
  if (generoLabel) result.genero = stripHtml(generoLabel);

  const estreiaLabel = html.match(/<b>\s*Data\s+de\s+Lan(?:ç|c)amento:\s*<\/b>\s*([\s\S]{1,60}?)(?:<\/p>|<br|<div)/i)?.[1];
  if (estreiaLabel) {
    const cleaned = stripHtml(estreiaLabel);
    const dmY = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    result.data_estreia = dmY ? `${dmY[3]}-${dmY[2]}-${dmY[1]}` : cleaned;
  }

  const classifAria = html.match(/aria-label=["']Classifica(?:ç|c)[aã]o\s+Indicativa\s+([^"']+)["']/i)?.[1];
  if (classifAria) {
    result.classificacao = stripHtml(classifAria).replace(/^indicativa\s*/i, "").trim();
  } else {
    const classifSpan = html.match(/class=["'][^"']*classificacao-indicativa[^"']*["'][\s\S]{0,220}?<span[^>]*>\s*([^<]{1,10})\s*<\/span>/i)?.[1];
    if (classifSpan) result.classificacao = stripHtml(classifSpan);
  }

  const cardMeta = html.match(/<h3[^>]*class=["'][^"']*card-text[^"']*["'][^>]*>\s*([^<]{2,120})\s*<\/h3>/i)?.[1];
  if (cardMeta) {
    const clean = stripHtml(cardMeta);
    const parts = clean.split("•").map((p) => p.trim()).filter(Boolean);
    if (!result.duracao && parts[0]) result.duracao = parts[0];
    if (!result.genero && parts[1]) result.genero = parts[1];
  }

  if (!result.data_estreia && /(^|\s)estreia(\s|$)/i.test(stripHtml(html))) {
    result.data_estreia = "estreia";
  }

  result.poster_url = extractPosterFromHtml(html) || null;
  result.trailer_url = extractTrailerFromHtml(html);

  return result;
};

const inferSituacaoExibicao = (params: {
  sourceUrl?: string | null;
  pageHtml?: string | null;
  contextHtml?: string | null;
}): "em_cartaz" | "em_breve" | "pre_venda" | "desconhecido" => {
  const joined = normalizeText(
    `${params.sourceUrl || ""} ${params.pageHtml || ""} ${params.contextHtml || ""}`,
  );

  if (joined.includes("pre venda") || joined.includes("prevenda")) return "pre_venda";
  if (joined.includes("em breve")) return "em_breve";
  if (
    joined.includes("programacao") ||
    joined.includes("programacao em cartaz") ||
    joined.includes("em cartaz") ||
    joined.includes("/cartaz")
  ) {
    return "em_cartaz";
  }
  return "desconhecido";
};

const extractTitleFromHtml = (html: string): string | null => {
  const og = extractMeta(html, "og:title", "property");
  if (og) return og;

  const tw = extractMeta(html, "twitter:title", "name");
  if (tw) return tw;

  const h1 = html.match(/<h1[^>]*>([\s\S]{1,200}?)<\/h1>/i)?.[1];
  if (h1) return stripHtml(h1);

  const title = html.match(/<title[^>]*>([\s\S]{1,200}?)<\/title>/i)?.[1];
  if (title) return stripHtml(title);

  return null;
};

const extractHorariosFromHtml = (html: string): string[] => {
  const raw: string[] = [];

  // Extrai apenas de anchors de sessão para evitar horários falsos de metadados (created_at etc).
  for (const anchorMatch of html.matchAll(/<a\b[^>]*>[\s\S]{0,280}?<\/a>/gi)) {
    const anchorHtml = anchorMatch[0];
    if (!/btn-horario/i.test(anchorHtml)) continue;

    const href = anchorHtml.match(/href=["']([^"']+)["']/i)?.[1] || "";
    if (!/sessao=/i.test(href)) continue;

    const sessaoMatch = href.match(/[?&]sessao=[^"'&\s]*?_(\d{2})(\d{2})/i);
    if (sessaoMatch) {
      raw.push(`${sessaoMatch[1]}:${sessaoMatch[2]}`);
    }

    const text = stripHtml(anchorHtml);
    const textMatch = text.match(/\b([01]?\d|2[0-3])[:h]([0-5]\d)\b/i);
    if (textMatch) {
      raw.push(`${textMatch[1]}:${textMatch[2]}`);
    }
  }

  return dedupeHorarios(raw);
};

const extractDiasFromHtml = (html: string): string[] => {
  const raw: string[] = [];

  for (const anchorMatch of html.matchAll(/<a\b[^>]*>[\s\S]{0,320}?<\/a>/gi)) {
    const anchorHtml = anchorMatch[0];
    const href = anchorHtml.match(/href=["']([^"']+)["']/i)?.[1] || "";
    if (!/dia=\d{8}/i.test(href)) continue;
    const diaMatch = href.match(/[?&]dia=(\d{8})/i);
    if (diaMatch) raw.push(diaMatch[1]);
  }

  return dedupeDias(raw);
};

const collectJsonLdObjects = (html: string): unknown[] => {
  const blocks = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const out: unknown[] = [];
  for (const match of blocks) {
    const raw = (match[1] || "").trim();
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      out.push(parsed);
    } catch {
      // ignore invalid block
    }
  }
  return out;
};

const flattenJson = (value: unknown): Record<string, unknown>[] => {
  const out: Record<string, unknown>[] = [];
  const walk = (node: unknown) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const item of node) walk(item);
      return;
    }
    if (typeof node === "object") {
      const obj = node as Record<string, unknown>;
      out.push(obj);
      if (obj["@graph"]) walk(obj["@graph"]);
      if (obj.itemListElement) walk(obj.itemListElement);
      if (obj.mainEntity) walk(obj.mainEntity);
    }
  };
  walk(value);
  return out;
};

const isMovieLike = (obj: Record<string, unknown>): boolean => {
  const rawType = obj["@type"];
  const types = asArray(rawType).map((v) => String(v).toLowerCase());
  return types.some((t) => t.includes("movie"));
};

const extractMoviesFromJsonLd = (html: string, siteUrl: string): FilmeExtraido[] => {
  const blocks = collectJsonLdObjects(html);
  const movies: FilmeExtraido[] = [];

  for (const block of blocks) {
    const flat = flattenJson(block);
    for (const obj of flat) {
      if (!isMovieLike(obj)) continue;
      const titulo = firstString(obj.name, obj.headline);
      if (!titulo || isLikelyGenericTitle(titulo)) continue;

      const sinopse = firstString(obj.description);
      const generoValue = obj.genre;
      const genero = Array.isArray(generoValue)
        ? generoValue.map((g) => String(g)).join(", ")
        : firstString(generoValue);

      const duration = firstString(obj.duration);
      const contentRating = firstString(obj.contentRating);
      const inLanguage = firstString(obj.inLanguage);
      const datePublished = firstString(obj.datePublished, obj.dateCreated, obj.dateModified);
      const poster = getImageFromUnknown(obj.image);
      const trailerObj = obj.trailer as Record<string, unknown> | undefined;
      const trailer = firstString(trailerObj?.url, trailerObj?.embedUrl);

      const horariosRaw: string[] = [];
      const offers = asArray(obj.offers as unknown);
      for (const offer of offers) {
        if (offer && typeof offer === "object") {
          const offerObj = offer as Record<string, unknown>;
          const starts = firstString(offerObj.availabilityStarts, offerObj.validFrom);
          if (starts) horariosRaw.push(starts);
          const startDate = firstString(offerObj.startDate, offerObj.startTime);
          if (startDate) horariosRaw.push(startDate);
        }
      }
      const horarios = dedupeHorarios(horariosRaw);

      const urlOrigem = normalizeUrl(firstString(obj.url) || siteUrl, siteUrl);

      movies.push({
        titulo: stripHtml(titulo),
        sinopse: sinopse ? stripHtml(sinopse) : null,
        genero: genero ? stripHtml(genero) : null,
        duracao: duration,
        classificacao: contentRating,
        idioma: inLanguage,
        data_estreia: datePublished,
        poster_url: !isBadPosterUrl(poster) ? poster : extractPosterFromHtml(html, siteUrl),
        trailer_url: normalizeYouTubeUrl(trailer) || extractTrailerFromHtml(html),
        horarios,
        dias_exibicao: [],
        situacao_exibicao: inferSituacaoExibicao({ sourceUrl: siteUrl, pageHtml: html }),
        url_origem: urlOrigem,
        dados_brutos: obj,
      });
    }
  }

  return movies;
};

const extractMoviesFromAnchors = async (html: string, siteUrl: string): Promise<FilmeExtraido[]> => {
  const out: FilmeExtraido[] = [];
  const re = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]{1,220})<\/a>/gi;
  const seenHref = new Set<string>();
  const candidates: Array<{ href: string; anchorText: string; contextHtml: string }> = [];

  for (const match of html.matchAll(re)) {
    const href = normalizeUrl(match[1] || "", siteUrl);
    if (!href) continue;

    const innerHtml = match[2] || "";
    const textFromInner = stripHtml(innerHtml);
    const altFromImage =
      innerHtml.match(/<img[^>]+alt=["']([^"']+)["']/i)?.[1] ||
      innerHtml.match(/<img[^>]+title=["']([^"']+)["']/i)?.[1] ||
      "";
    const anchorText = stripHtml(textFromInner || altFromImage);

    if (!isLikelyMovieUrl(href)) continue;
    if (seenHref.has(href)) continue;
    seenHref.add(href);

    const contextStart = Math.max(0, (match.index ?? 0) - 200);
    const contextEnd = Math.min(html.length, (match.index ?? 0) + 2600);
    const contextHtml = html.slice(contextStart, contextEnd);
    candidates.push({ href, anchorText, contextHtml });
  }

  for (const candidate of candidates.slice(0, 80)) {
    const detailHtml = await fetchHtml(candidate.href);
    const detailJsonLd = detailHtml ? extractMoviesFromJsonLd(detailHtml, candidate.href) : [];
    const detailMeta = detailHtml ? extractMovieMetaFromHtml(detailHtml) : extractMovieMetaFromHtml(candidate.contextHtml);
    const posterFromContext = extractPosterFromHtml(candidate.contextHtml, siteUrl);
    const horariosFromListing = extractHorariosFromHtml(candidate.contextHtml);
    const diasFromListing = extractDiasFromHtml(candidate.contextHtml);

    if (detailJsonLd.length > 0) {
      const first = detailJsonLd[0];
      if (!isLikelyGenericTitle(first.titulo)) {
        const horariosFallback = detailHtml ? extractHorariosFromHtml(detailHtml) : [];
        out.push({
          ...first,
          genero: first.genero || detailMeta.genero,
          duracao: first.duracao || detailMeta.duracao,
          data_estreia: first.data_estreia || detailMeta.data_estreia,
          classificacao: first.classificacao || detailMeta.classificacao,
          poster_url: !isBadPosterUrl(first.poster_url) ? first.poster_url : (detailMeta.poster_url || posterFromContext),
          trailer_url: first.trailer_url || detailMeta.trailer_url || extractTrailerFromHtml(candidate.contextHtml),
          horarios: first.horarios.length > 0 ? first.horarios : dedupeHorarios([...horariosFromListing, ...horariosFallback]),
          dias_exibicao: dedupeDias([...diasFromListing, ...(detailHtml ? extractDiasFromHtml(detailHtml) : [])]),
          situacao_exibicao: inferSituacaoExibicao({
            sourceUrl: siteUrl,
            pageHtml: detailHtml || null,
            contextHtml: candidate.contextHtml,
          }),
          url_origem: first.url_origem || candidate.href,
          dados_brutos: {
            ...first.dados_brutos,
            source: "detail_jsonld",
            anchor_text: candidate.anchorText,
          },
        });
      }
      continue;
    }

    const detailTitle = detailHtml ? extractTitleFromHtml(detailHtml) : null;
    const chosenTitle = detailTitle && !isLikelyGenericTitle(detailTitle) ? detailTitle : candidate.anchorText;
    if (isLikelyGenericTitle(chosenTitle)) continue;

    const description = detailHtml
      ? extractMeta(detailHtml, "og:description", "property") || extractMeta(detailHtml, "description", "name")
      : null;
    const poster = detailHtml ? extractMeta(detailHtml, "og:image", "property") : null;
    const horariosDetail = detailHtml ? extractHorariosFromHtml(detailHtml) : [];
    const diasDetail = detailHtml ? extractDiasFromHtml(detailHtml) : [];
    const horarios = dedupeHorarios([...horariosFromListing, ...horariosDetail]);
    const dias_exibicao = dedupeDias([...diasFromListing, ...diasDetail]);

    out.push({
      titulo: chosenTitle,
      sinopse: description,
      genero: detailMeta.genero,
      duracao: detailMeta.duracao,
      classificacao: detailMeta.classificacao,
      idioma: null,
      data_estreia: detailMeta.data_estreia,
      poster_url: !isBadPosterUrl(poster) ? poster : (detailMeta.poster_url || posterFromContext),
      trailer_url: detailMeta.trailer_url || extractTrailerFromHtml(candidate.contextHtml),
      horarios,
      dias_exibicao,
      situacao_exibicao: inferSituacaoExibicao({
        sourceUrl: siteUrl,
        pageHtml: detailHtml || null,
        contextHtml: candidate.contextHtml,
      }),
      url_origem: candidate.href,
      dados_brutos: {
        source: "detail_fallback",
        href: candidate.href,
        anchor_text: candidate.anchorText,
      },
    });
  }

  return out;
};

const dedupeMovies = <T extends FilmeExtraido>(movies: T[]): T[] => {
  const map = new Map<string, T>();
  for (const movie of movies) {
    const key = `${normalizeText(movie.titulo)}|${movie.url_origem || ""}`;
    if (!map.has(key)) {
      map.set(key, movie);
      continue;
    }
    const current = map.get(key)!;
    if (!current.sinopse && movie.sinopse) current.sinopse = movie.sinopse;
    if (!current.poster_url && movie.poster_url) current.poster_url = movie.poster_url;
    if (!current.trailer_url && movie.trailer_url) current.trailer_url = movie.trailer_url;
    if (movie.horarios.length > 0) {
      current.horarios = dedupeHorarios([...(current.horarios || []), ...movie.horarios]);
    }
    if (movie.dias_exibicao.length > 0) {
      current.dias_exibicao = dedupeDias([...(current.dias_exibicao || []), ...movie.dias_exibicao]);
    }
    if (!current.genero && movie.genero) current.genero = movie.genero;
    if (!current.data_estreia && movie.data_estreia) current.data_estreia = movie.data_estreia;
    if (current.situacao_exibicao === "desconhecido" && movie.situacao_exibicao !== "desconhecido") {
      current.situacao_exibicao = movie.situacao_exibicao;
    }
  }
  return [...map.values()];
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const cidadeId = String(body?.cidade_id || "").trim();
    const maxFilmes = Math.max(1, Math.min(Number(body?.max_filmes || 120), 500));

    if (!cidadeId) {
      return new Response(JSON.stringify({ error: "cidade_id obrigatorio" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRole) {
      throw new Error("SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY ausente.");
    }

    const supabase = createClient(supabaseUrl, serviceRole);

    const { data: fontesDb, error: fontesError } = await supabase
      .from("cidade_scraping_cinema_fonte")
      .select("id, nome, url, tipo, ativo")
      .eq("cidade_id", cidadeId)
      .eq("ativo", true)
      .order("ordem", { ascending: true });

    if (fontesError) throw fontesError;

    const fontesAtivas = (fontesDb || []) as FonteCinema[];
    const fontesPayload = Array.isArray(body.sites)
      ? body.sites
          .map((s) => String(s || "").trim())
          .filter(Boolean)
          .map((url) => ({
            id: null as string | null,
            nome: new URL(url).hostname,
            url,
            tipo: "auto" as const,
            ativo: true,
          }))
      : [];

    const sources = fontesAtivas.length > 0 ? fontesAtivas : fontesPayload;
    if (sources.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: "Nenhuma fonte ativa cadastrada para esta cidade." }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const allMovies: Array<FilmeExtraido & { fonte_id: string | null; fonte_nome: string; site_url: string }> = [];
    const logs: string[] = [];

    for (const source of sources) {
      const siteUrl = source.url;
      if (!/^https?:\/\//i.test(siteUrl)) {
        logs.push(`Fonte ignorada (URL invalida): ${siteUrl}`);
        continue;
      }

      const html = await fetchHtml(siteUrl);
      if (!html) {
        logs.push(`Falha ao carregar fonte: ${siteUrl}`);
        continue;
      }

      const fromJsonLd = extractMoviesFromJsonLd(html, siteUrl);
      const fromAnchorFallback = await extractMoviesFromAnchors(html, siteUrl);
      const merged = dedupeMovies([...fromJsonLd, ...fromAnchorFallback]).slice(0, maxFilmes);

      logs.push(`Fonte ${source.nome}: ${merged.length} filme(s) extraido(s).`);

      for (const movie of merged) {
        allMovies.push({
          ...movie,
          fonte_id: source.id,
          fonte_nome: source.nome,
          site_url: siteUrl,
        });
      }
    }

    const deduped = dedupeMovies(allMovies).slice(0, maxFilmes);

    const rows = deduped.map((movie) => {
      const baseKey = `${normalizeText(movie.titulo)}|${movie.site_url}|${movie.url_origem || ""}`;
      const dedupeKey = hashDjb2(baseKey);
      return {
        cidade_id: cidadeId,
        fonte_id: movie.fonte_id,
        fonte_nome: movie.fonte_nome,
        site_url: movie.site_url,
        url_origem: movie.url_origem,
        titulo: movie.titulo,
        sinopse: movie.sinopse,
        genero: movie.genero,
        duracao: movie.duracao,
        classificacao: movie.classificacao,
        idioma: movie.idioma,
        data_estreia: movie.data_estreia,
        poster_url: movie.poster_url,
        trailer_url: movie.trailer_url,
        horarios: movie.horarios,
        dias_exibicao: movie.dias_exibicao,
        situacao_exibicao: movie.situacao_exibicao,
        status: "coletado",
        dedupe_key: dedupeKey,
        dados_brutos: movie.dados_brutos,
      };
    });

    const { error: deleteOldError } = await supabase
      .from("filmes_scraping")
      .delete()
      .eq("cidade_id", cidadeId);
    if (deleteOldError) throw deleteOldError;

    if (rows.length > 0) {
      const { error: insertError } = await supabase
        .from("filmes_scraping")
        .insert(rows);
      if (insertError) throw insertError;
    }

    // Sincroniza com a tabela final de cinema sem afetar registros manuais:
    // apenas remove/reinsere itens identificados por id_externo com prefixo "scraping:".
    const { error: deleteCinemaSyncError } = await supabase
      .from("rel_cidade_cinema")
      .delete()
      .eq("cidade_id", cidadeId)
      .like("id_externo", "scraping:%");
    if (deleteCinemaSyncError) throw deleteCinemaSyncError;

    if (rows.length > 0) {
      const cinemaRows = rows.map((movie) => {
        const nomeCinema =
          (movie.fonte_nome && movie.fonte_nome.trim()) ||
          (() => {
            try {
              return new URL(movie.site_url).hostname;
            } catch {
              return "Cinema";
            }
          })();

        const situacao = (movie.situacao_exibicao as string | null) || "desconhecido";
        const status = situacao === "desconhecido" ? "em_cartaz" : situacao;

        return {
          cidade_id: movie.cidade_id,
          nome_filme: movie.titulo,
          sinopse: movie.sinopse,
          nome_cinema: nomeCinema,
          banner_url: movie.poster_url,
          trailer_url: movie.trailer_url,
          horarios: movie.horarios || [],
          dias_exibicao: movie.dias_exibicao || [],
          id_externo: `scraping:${movie.dedupe_key}`,
          duracao: movie.duracao,
          genero: movie.genero,
          status,
          classificacao: movie.classificacao,
          idioma: movie.idioma,
          situacao_exibicao: situacao,
        };
      });

      const { error: insertCinemaSyncError } = await supabase
        .from("rel_cidade_cinema")
        .insert(cinemaRows);
      if (insertCinemaSyncError) throw insertCinemaSyncError;
    }
    logs.push(`Sincronizacao rel_cidade_cinema: ${rows.length} registro(s).`);

    return new Response(
      JSON.stringify({
        ok: true,
        cidade_id: cidadeId,
        total_fontes: sources.length,
        total_filmes_encontrados: deduped.length,
        total_salvos: rows.length,
        logs,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
