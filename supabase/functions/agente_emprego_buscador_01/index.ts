import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: "https://www.google.com/",
  "Upgrade-Insecure-Requests": "1",
};

interface RequestBody {
  cidade_id: string;
  sites?: string[];
  max_vagas?: number;
  lookback_dias?: number;
}

interface Vaga {
  titulo: string;
  empresa: string | null;
  descricao: string | null;
  area: string | null;
  tipo_contrato: string | null;
  salario: string | null;
  local_vaga: string | null;
  url_origem: string | null;
  fonte_nome: string;
  contato: string | null;
}

// ============================================================
// HELPERS DE TEXTO
// ============================================================

const decodeHtml = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
   .replace(/&lt;/g, "<").replace(/&gt;/g, ">")
   .replace(/&nbsp;/g, " ").replace(/\u00a0/g, " ")
   .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
   .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

const stripHtml = (s: string) =>
  decodeHtml(s)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

const norm = (s: string) =>
  s.toLowerCase().normalize("NFD")
   .replace(/[\u0300-\u036f]/g, "")
   .replace(/[^a-z0-9 ]/g, " ")
   .replace(/\s+/g, " ").trim();

const clamp = (s: string, max: number) => s.slice(0, max);

const SALARIO_COM_MOEDA_RE = /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i;
const SALARIO_SEM_MOEDA_RE = /\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/;

const sanitizeSalario = (raw: string | null): string | null => {
  if (!raw) return null;
  const cleaned = raw.trim().slice(0, 180);
  if (!cleaned) return null;
  const n = norm(cleaned);
  const badTokens = new Set([
    "blog",
    "home",
    "inicio",
    "menu",
    "vagas",
    "empregos",
    "cadastro",
    "login",
    "contato",
    "politica",
    "termos",
  ]);
  if (badTokens.has(n)) return null;
  if (/mercado|salario minimo|m�nimo/.test(n)) return null;

  // Regra de neg�cio: somente valor monet�rio objetivo (R$ x.xxx,xx).
  const withCurrency = cleaned.match(SALARIO_COM_MOEDA_RE);
  if (withCurrency) return `R$ ${withCurrency[1]}`;

  const withoutCurrency = cleaned.match(SALARIO_SEM_MOEDA_RE);
  if (withoutCurrency) return `R$ ${withoutCurrency[1]}`;

  return null;
};

// ============================================================
// EXTRATORES SEMÂNTICOS
// ============================================================

const extractSalario = (text: string): string | null => {
  const labelMatch = text.match(/sal[aá]rio[^:\n]{0,20}[:\s]+([^\n]{3,80})/i);
  if (labelMatch) return sanitizeSalario(labelMatch[1].trim().slice(0, 100));
  const rMatch = text.match(/R\$\s*[\d.,]+(?:[^\n]{0,50}comiss[aã]o[^\n]{0,50})?/i);
  if (rMatch) return sanitizeSalario(rMatch[0].trim().slice(0, 100));
  const milMatch = text.match(/[\d.,]+\s*(?:mil|k)\b/i);
  if (milMatch) return sanitizeSalario(milMatch[0].trim());
  return null;
};

const extractPhones = (text: string): string[] => {
  const RE = /(?:\+?55[\s-]?)?(?:\(?\d{2}\)?[\s.-]?)(?:9\d{4}|\d{4})[\s.-]?\d{4}/g;
  const found = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = RE.exec(text)) !== null) {
    const cleaned = m[0].replace(/\s+/g, " ").trim();
    if (cleaned.replace(/\D/g, "").length >= 10) found.add(cleaned);
  }
  return Array.from(found);
};

const extractEmail = (text: string): string | null => {
  const m = text.match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0] : null;
};

// Extrai href="tel:..." e href="mailto:..." direto do HTML — mais confiável
const extractHrefContacts = (html: string): { tels: string[]; emails: string[]; whatsapp: string | null } => {
  const tels = new Set<string>();
  const emails = new Set<string>();
  let whatsapp: string | null = null;

  const telRe = /href=["']tel:([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = telRe.exec(html)) !== null) {
    const digits = m[1].replace(/\D/g, "");
    if (digits.length >= 10) tels.add(m[1].trim());
  }

  const mailRe = /href=["']mailto:([^"'?]+)/gi;
  while ((m = mailRe.exec(html)) !== null) {
    emails.add(m[1].trim());
  }

  const waRe = /(?:wa\.me|api\.whatsapp\.com\/send\?phone=)[=\/]?(\+?\d{10,15})/i;
  const waMatch = html.match(waRe);
  if (waMatch) {
    whatsapp = `https://wa.me/${waMatch[1].replace(/\D/g, "")}`;
  } else {
    // Fallback: busca wa.me em texto plano
    const textWa = html.match(/wa\.me\/(\+?\d{10,15})/i);
    if (textWa) whatsapp = `https://wa.me/${textWa[1].replace(/\D/g, "")}`;
  }

  return { tels: Array.from(tels), emails: Array.from(emails), whatsapp };
};

const buildContato = (html: string, text: string): string | null => {
  const parts: string[] = [];
  const hrefs = extractHrefContacts(html);

  if (hrefs.whatsapp) parts.push(`WhatsApp: ${hrefs.whatsapp}`);

  const allPhones = new Set<string>([...hrefs.tels, ...extractPhones(text)]);
  const waDigits = hrefs.whatsapp ? hrefs.whatsapp.replace(/\D/g, "").slice(-8) : null;
  for (const p of allPhones) {
    if (waDigits && p.replace(/\D/g, "").endsWith(waDigits)) continue;
    parts.push(`Tel: ${p}`);
    if (parts.length > 4) break;
  }

  const email = hrefs.emails[0] || extractEmail(text);
  if (email) parts.push(`Email: ${email}`);

  return parts.length ? parts.join(" | ") : null;
};

const extractContrato = (text: string): string | null => {
  const n = norm(text);
  if (/\bclt\b/.test(n)) return "CLT";
  if (/\bpj\b|pessoa juridica/.test(n)) return "PJ";
  if (/estagiar|estagio/.test(n)) return "Estagio";
  if (/freelance|autonomo/.test(n)) return "Freelance";
  if (/temporario/.test(n)) return "Temporario";
  return null;
};

const extractModalidade = (text: string): string | null => {
  const n = norm(text);
  if (/home.?office|remoto/.test(n)) return "Remoto";
  if (/hibrido/.test(n)) return "Hibrido";
  if (/presencial/.test(n)) return "Presencial";
  return null;
};

const AREA_PATTERNS: Array<[RegExp, string]> = [
  [/\b(desenvolvedor|programador|software|sistema|banco.?de.?dados|tecnologia.?da.?info|devops|cloud|ti\b)/, "Tecnologia"],
  [/\b(vendedor|venda.?externa|venda.?pap|porta.?a.?porta|consultor.?de.?vendas|representante.?comercial|promotor.?de.?vendas)/, "Vendas"],
  [/\b(marketing|social.?media|conteudo|seo|midia.?digital)/, "Marketing"],
  [/\b(enfermeiro|medico|farmacia|fisioterapeuta|saude|hospital|clinica|dentist)/, "Saude"],
  [/\b(professor|ensino|pedagogia|educacao|docente|tutor)/, "Educacao"],
  [/\b(contador|contabilidade|fiscal|tributario|financeiro|tesoureiro)/, "Financeiro"],
  [/\b(advogado|direito|juridico|juridica|paralegal)/, "Juridico"],
  [/\b(logistica|estoque|motorista|entregador|transporte|almoxarife|operador.?logistico)/, "Logistica"],
  [/\b(recursos.?humanos|recrutamento|selecao|\brh\b|\bdp\b|departamento.?pessoal)/, "RH"],
  [/\b(auxiliar.?admin|assistente.?admin|secretaria|recepcionist|office.?boy)/, "Administrativo"],
  [/\b(engenheiro|engenharia|eletric|mecanico|civil|estrutural|hidrau)/, "Engenharia"],
  [/\b(designer|design|ui|ux|grafico|arte.?final|diagramac)/, "Design"],
  [/\b(operador|ajudante|servicos.?gerais|limpeza|zelador|auxiliar.?geral)/, "Operacional"],
  [/\b(atendente|call.?center|telemarketing|suporte.?ao.?cliente|sac)/, "Atendimento"],
  [/\b(operador.?de.?caixa|caixa\b|frente.?de.?caixa)/, "Varejo"],
];

const extractArea = (text: string): string | null => {
  const n = norm(text);
  for (const [re, label] of AREA_PATTERNS) {
    if (re.test(n)) return label;
  }
  return null;
};

const extractAreaTitleFirst = (titulo: string, descricao?: string | null): string | null => {
  const fromTitle = extractArea(titulo);
  if (fromTitle) return fromTitle;
  return extractArea(`${titulo} ${descricao || ""}`);
};

// ============================================================
// META TAGS (og:*, description, twitter:*)
// ============================================================

const extractMeta = (html: string, prop: string): string | null => {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"),
    new RegExp(`<meta[^>]+name=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${prop}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return decodeHtml(m[1]).trim();
  }
  return null;
};

// ============================================================
// FETCH
// ============================================================

const fetchHtml = async (url: string, ms = 18000): Promise<string | null> => {
  const tryFetch = async (targetUrl: string, headers: Record<string, string>, timeoutMs: number) => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const r = await fetch(targetUrl, { headers, signal: ctrl.signal });
      if (!r.ok) return null;
      return await r.text();
    } catch {
      return null;
    } finally {
      clearTimeout(t);
    }
  };

  const first = await tryFetch(url, HEADERS, ms);
  if (first) return first;

  const second = await tryFetch(
    url,
    {
      ...HEADERS,
      "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0 Safari/537.36",
    },
    ms,
  );
  if (second) return second;

  const jinaUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//i, "")}`;
  const third = await tryFetch(
    jinaUrl,
    { "User-Agent": "Mozilla/5.0", Accept: "text/plain,*/*" },
    ms + 4000,
  );
  if (third) return third;

  return null;
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ============================================================
// EXTRAÇÃO DE ESTADO EMBUTIDO (Next/Nuxt/Apollo/Redux)
// ============================================================

const SPA_STATE_PATTERNS = [
  { name: "__NEXT_DATA__", re: /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i, jsonMode: "direct" as const },
  { name: "__NUXT__", re: /<script[^>]*>[\s\S]*?window\.__NUXT__\s*=\s*([\s\S]*?);?\s*<\/script>/i, jsonMode: "eval" as const },
  { name: "__APOLLO_STATE__", re: /window\.__APOLLO_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i, jsonMode: "direct" as const },
  { name: "__INITIAL_STATE__", re: /window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i, jsonMode: "direct" as const },
  { name: "__PRELOADED_STATE__", re: /window\.__PRELOADED_STATE__\s*=\s*(\{[\s\S]*?\})\s*;?\s*<\/script>/i, jsonMode: "direct" as const },
];

const extractSpaState = (html: string): Record<string, unknown> | null => {
  for (const { re } of SPA_STATE_PATTERNS) {
    const m = html.match(re);
    if (!m) continue;
    const raw = m[1].trim();
    try {
      const data = JSON.parse(raw);
      const str = JSON.stringify(data);
      if (str.includes('"title"') || str.includes('"titulo"') || str.includes('"jobTitle"') || str.includes('"description"') || str.includes('"descricao"')) {
        return data;
      }
    } catch { /* tenta próximo */ }
  }
  return null;
};

const deepFind = (obj: unknown, keys: string[]): string | null => {
  if (!obj || typeof obj !== "object") return null;
  for (const k of keys) {
    const val = (obj as Record<string, unknown>)[k];
    if (typeof val === "string" && val.trim()) return val.trim();
  }
  for (const v of Object.values(obj as Record<string, unknown>)) {
    const r = deepFind(v, keys);
    if (r) return r;
  }
  return null;
};

const vagaFromSpaState = (data: Record<string, unknown>, url: string, fonteNome: string, html: string): Vaga | null => {
  const titulo = deepFind(data, ["title", "titulo", "jobTitle", "nome", "name"]);
  if (!titulo) return null;
  const descRaw = deepFind(data, ["description", "descricao", "jobDescription", "body", "content", "detalhes"]);
  const desc = descRaw ? stripHtml(descRaw).slice(0, 2000) : null;
  const empresa = deepFind(data, ["companyName", "company", "empresa", "employerName", "hiringOrganization", "razaoSocial"]);
  const salarioRaw = deepFind(data, ["salary", "salario", "wage", "salaryRange", "remuneracao"]);
  const local = deepFind(data, ["city", "cidade", "location", "localizacao", "addressLocality"]);
  const tudo = [titulo, desc, salarioRaw].filter(Boolean).join(" ");
  const textoPlain = stripHtml(tudo);
  return {
    titulo: clamp(stripHtml(titulo), 200),
    empresa: empresa ? clamp(stripHtml(empresa), 150) : null,
    descricao: desc,
    area: extractAreaTitleFirst(titulo, desc),
    tipo_contrato: extractContrato(tudo),
    salario: salarioRaw ? sanitizeSalario(clamp(stripHtml(salarioRaw), 100)) : extractSalario(textoPlain),
    local_vaga: local ? clamp(stripHtml(local), 150) : extractModalidade(textoPlain),
    url_origem: url,
    fonte_nome: fonteNome,
    contato: buildContato(html, textoPlain),
  };
};

const vagaFromJsonLd = (html: string, url: string, fonteNome: string): Vaga | null => {
  const blocks = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || [];
  for (const block of blocks) {
    try {
      const json = block.replace(/<script[^>]*>/i, "").replace(/<\/script>/i, "");
      const data = JSON.parse(json);
      const items: unknown[] = Array.isArray(data) ? data : [data];
      for (const item of items) {
        if (typeof item !== "object" || !item) continue;
        const type = (item as Record<string, unknown>)["@type"];
        if (!String(type || "").toLowerCase().includes("job")) continue;
        const titulo = deepFind(item, ["title", "name"]);
        if (!titulo) continue;
        const descRaw = deepFind(item, ["description"]);
        const desc = descRaw ? stripHtml(descRaw).slice(0, 2000) : null;
        const hiringOrg = (item as Record<string, unknown>)["hiringOrganization"];
        const empresa = typeof hiringOrg === "object" && hiringOrg
          ? deepFind(hiringOrg, ["name"])
          : typeof hiringOrg === "string" ? hiringOrg : null;
        const jobLocation = (item as Record<string, unknown>)["jobLocation"];
        const localRaw = jobLocation && typeof jobLocation === "object"
          ? deepFind(jobLocation, ["addressLocality", "addressRegion", "name"])
          : null;
        const salarioRaw = deepFind(item, ["salary"]) ||
          (() => {
            const bs = (item as Record<string, unknown>)["baseSalary"];
            if (typeof bs === "object" && bs) return deepFind(bs, ["value"]);
            return null;
          })();
        const tudo = [titulo, desc, salarioRaw || "", String((item as Record<string, unknown>)["employmentType"] || "")].join(" ");
        const textoPlain = [titulo, desc].filter(Boolean).join(" ") + " " + stripHtml(html).slice(0, 5000);
        const contato = buildContato(html, textoPlain);
        return {
          titulo: clamp(stripHtml(titulo), 200),
          empresa: empresa ? clamp(stripHtml(empresa), 150) : null,
          descricao: desc,
          area: extractAreaTitleFirst(titulo, desc),
          tipo_contrato: extractContrato(tudo),
          salario: salarioRaw ? sanitizeSalario(clamp(stripHtml(String(salarioRaw)), 100)) : extractSalario(textoPlain),
          local_vaga: localRaw ? clamp(stripHtml(localRaw), 150) : extractModalidade(textoPlain),
          url_origem: url,
          fonte_nome: fonteNome,
          contato,
        };
      }
    } catch { /* ignora */ }
  }
  return null;
};

const vagaHeuristica = (html: string, url: string, fonteNome: string): Vaga | null => {
  const texto = stripHtml(html);
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  let titulo: string | null = h1 ? clamp(stripHtml(h1[1]), 200) : null;
  if (!titulo) titulo = extractMeta(html, "og:title");
  if (!titulo) titulo = extractMeta(html, "twitter:title");
  if (!titulo || titulo.length < 4) return null;

  let empresa: string | null = null;
  const eMatch = html.match(/class="[^"]*(?:company|employer|empresa)[^"]*"[^>]*>([^<]{2,100})</i);
  if (eMatch) empresa = clamp(stripHtml(eMatch[1]), 150);

  // Combina descrição de várias fontes
  const metaDesc = extractMeta(html, "og:description") || extractMeta(html, "description") || extractMeta(html, "twitter:description");
  const textoSlice = texto.slice(0, 8000);
  const descricaoCombinada = [metaDesc, textoSlice].filter(Boolean).join("\n\n").slice(0, 2000);

  return {
    titulo,
    empresa,
    descricao: descricaoCombinada || null,
    area: extractAreaTitleFirst(titulo, descricaoCombinada),
    tipo_contrato: extractContrato(descricaoCombinada),
    salario: extractSalario(descricaoCombinada),
    local_vaga: extractModalidade(descricaoCombinada),
    url_origem: url,
    fonte_nome: fonteNome,
    contato: buildContato(html, descricaoCombinada),
  };
};

const extractJobDetail = (html: string, url: string, fonteNome: string): Vaga | null => {
  const spaState = extractSpaState(html);
  if (spaState) {
    const v = vagaFromSpaState(spaState, url, fonteNome, html);
    if (v) return v;
  }
  const ldVaga = vagaFromJsonLd(html, url, fonteNome);
  if (ldVaga) return ldVaga;
  return vagaHeuristica(html, url, fonteNome);
};

// Quality filter: vaga precisa ter título + pelo menos um dado útil
const vagaTemQualidade = (v: Vaga): boolean => {
  if (!v.titulo || v.titulo.length < 4) return false;
  const temDescSubstancial = !!v.descricao && v.descricao.length > 80;
  const temInfoExtra = !!(v.salario || v.contato || v.empresa);
  return temDescSubstancial || temInfoExtra;
};

// ============================================================
// RSS PARSER
// ============================================================

const parseRss = (xml: string, fonteNome: string, baseUrl: string): Vaga[] => {
  const vagas: Vaga[] = [];
  const items = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  for (const item of items) {
    const get = (tag: string) => {
      const m = item.match(new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"))
        || item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? stripHtml(m[1]).trim() : null;
    };
    const titulo = get("title");
    if (!titulo || titulo.length < 4) continue;
    const desc = get("description") || "";
    vagas.push({
      titulo: clamp(titulo, 200),
      empresa: get("author") || get("dc:creator") || null,
      descricao: desc.slice(0, 2000) || null,
      area: extractAreaTitleFirst(titulo, desc),
      tipo_contrato: extractContrato(desc),
      salario: extractSalario(desc),
      local_vaga: extractModalidade(desc),
      url_origem: get("link") || baseUrl,
      fonte_nome: fonteNome,
      contato: buildContato("", desc),
    });
  }
  return vagas;
};

// ============================================================
// FASE 1 — URLs DE VAGAS NA PÁGINA DE LISTAGEM
// ============================================================

// Padrões específicos para URLs de DETALHE (não listagem)
// A chave é exigir marcadores que só aparecem em páginas individuais:
// - "vaga-de-" (singular) + "__NNNNN" (id no InfoJobs)
// - "/vaga/12345", "/job/slug-12345", "/oportunidade/..."
// - IDs numéricos grandes no path
const JOB_URL_PATTERNS = [
  /\/vaga-de-[^\/]*__\d{4,}\.aspx/i,          // InfoJobs: vaga-de-xxx__11483079.aspx
  /\/vaga-de-[^\/]*-\d{4,}/i,                  // variação com hífen
  /\/vaga\/\d{3,}/i,                           // /vaga/12345
  /\/vaga\/[a-z0-9-]+\/\d{3,}/i,
  /\/vagas\/[a-z0-9-]+(?:\/[a-z0-9-]+)*\/\d{4,}\/?$/i,
  /\/emprego\/\d{3,}/i,
  /\/emprego\/[a-z0-9-]+\/\d{3,}/i,
  /\/job\/\d{3,}/i,
  /\/jobs\/\d{3,}/i,
  /\/job\/[a-z0-9-]+-\d{3,}/i,
  /\/viewjob\?/i,
  /\/rc\/clk\?/i,
  /[?&]jk=[a-z0-9]+/i,
  /\/oportunidade[s]?\/\d{3,}/i,
  /\/vacancy\/\d{3,}/i,
  /[\/\-](?:cargo|position)\/\d{3,}/i,
];

// Padrões que identificam LISTAGENS (a serem excluídas mesmo se baterem nos de detalhe)
const LISTING_URL_PATTERNS = [
  /\/vagas-de-/i,       // plural
  /\/empregos-de-/i,
  /\/jobs-in-/i,
  /\/search[\/\?]/i,
  /\/busca[\/\?]/i,
  /[\?&]page=/i,
  /[\?&]pagina=/i,
  /-p-\d+\.aspx/i,       // paginação
];

const resolveUrl = (href: string, base: string): string | null => {
  if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("javascript:")) return null;
  href = href.trim();
  if (href.startsWith("http://") || href.startsWith("https://")) return href;
  try { return new URL(href, base).href; } catch { return null; }
};

const extractJobUrls = (html: string, baseUrl: string, max: number): string[] => {
  const seen = new Set<string>();
  const baseHost = (() => {
    try { return new URL(baseUrl).hostname; } catch { return ""; }
  })();

  const pushIfJobUrl = (candidateUrl: string) => {
    const resolved = resolveUrl(candidateUrl, baseUrl);
    if (!resolved) return;
    try {
      if (baseHost && new URL(resolved).hostname !== baseHost) return;
    } catch {
      return;
    }
    if (resolved.split("?")[0] === baseUrl.split("?")[0]) return;
    if (LISTING_URL_PATTERNS.some((p) => p.test(resolved))) return;
    if (!JOB_URL_PATTERNS.some((p) => p.test(resolved))) return;
    if (seen.has(resolved)) return;
    seen.add(resolved);
  };

  const hrefRe = /href=["']([^"'#][^"']*)['"]/gi;
  let m: RegExpExecArray | null;
  while ((m = hrefRe.exec(html)) !== null) {
    pushIfJobUrl(m[1]);
    if (seen.size >= max) return Array.from(seen);
  }

  const mdLinkRe = /\[[^\]]{2,200}\]\((https?:\/\/[^\s)]+)\)/gi;
  while ((m = mdLinkRe.exec(html)) !== null) {
    pushIfJobUrl(m[1]);
    if (seen.size >= max) return Array.from(seen);
  }

  const plainUrlRe = /(https?:\/\/[^\s"'<>]+)/gi;
  while ((m = plainUrlRe.exec(html)) !== null) {
    pushIfJobUrl(m[1]);
    if (seen.size >= max) return Array.from(seen);
  }

  return Array.from(seen);
};

const extractVagasFromListing = (html: string, baseUrl: string, fonteNome: string, maxVagas: number): Vaga[] => {
  const vagas: Vaga[] = [];
  const seen = new Set<string>();

  const push = (tituloRaw: string, hrefRaw: string | null, descRaw: string | null = null) => {
    const titulo = clamp(stripHtml(tituloRaw || "").trim(), 200);
    if (titulo.length < 8) return;
    if (/^(home|inicio|menu|ver mais|saiba mais|detalhes)$/i.test(titulo)) return;
    if (!/\b(vaga|emprego|job|oportunidade|auxiliar|analista|assistente|vendedor|atendente|estagio|estagiario)\b/i.test(titulo)) return;

    const urlOrigem = hrefRaw ? resolveUrl(hrefRaw, baseUrl) : baseUrl;
    if (!urlOrigem || seen.has(urlOrigem)) return;
    seen.add(urlOrigem);

    const desc = descRaw ? stripHtml(descRaw).slice(0, 400) : null;
    vagas.push({
      titulo,
      empresa: null,
      descricao: desc,
      area: extractAreaTitleFirst(titulo, desc),
      tipo_contrato: extractContrato(titulo + " " + (desc || "")),
      salario: extractSalario(titulo + " " + (desc || "")),
      local_vaga: extractModalidade(titulo + " " + (desc || "")),
      url_origem: urlOrigem,
      fonte_nome: fonteNome,
      contato: null,
    });
  };

  const anchorRe = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = anchorRe.exec(html)) !== null) {
    push(m[2], m[1]);
    if (vagas.length >= maxVagas) return vagas;
  }

  const mdRe = /\[([^\]]{8,220})\]\((https?:\/\/[^\s)]+)\)/gi;
  while ((m = mdRe.exec(html)) !== null) {
    push(m[1], m[2]);
    if (vagas.length >= maxVagas) return vagas;
  }

  return vagas;
};

// ============================================================
// SCRAPE COMPLETO DE UM SITE (2 FASES)
// ============================================================

const scrapeSite = async (url: string, nome: string, maxVagas: number): Promise<{ vagas: Vaga[]; erro: string | null; descartadas: number }> => {
  const html = await fetchHtml(url);
  if (!html) return { vagas: [], erro: `Nao foi possivel acessar ${url}`, descartadas: 0 };
  if (html.trimStart().startsWith("<?xml") || html.includes("<rss") || html.includes("<feed")) {
    const rssVagas = parseRss(html, nome, url).slice(0, maxVagas);
    const filtradas = rssVagas.filter(vagaTemQualidade);
    return { vagas: filtradas, erro: null, descartadas: rssVagas.length - filtradas.length };
  }
  const jobUrls = extractJobUrls(html, url, maxVagas * 3);
  console.log(`[${nome}] Fase 1: ${jobUrls.length} URLs encontradas`);
  if (jobUrls.length === 0) {
    const fromListing = extractVagasFromListing(html, url, nome, maxVagas);
    if (fromListing.length > 0) {
      console.log(`[${nome}] Fallback listagem: ${fromListing.length} vagas`);
      return { vagas: fromListing, erro: null, descartadas: 0 };
    }
    return { vagas: [], erro: `Nenhuma URL de vaga encontrada em ${url}`, descartadas: 0 };
  }
  const vagas: Vaga[] = [];
  let descartadas = 0;
  const urls = jobUrls.slice(0, maxVagas);
  const BATCH = 4;
  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    const results = await Promise.all(batch.map(async (jobUrl) => {
      const pageHtml = await fetchHtml(jobUrl, 15000);
      if (!pageHtml) return null;
      return extractJobDetail(pageHtml, jobUrl, nome);
    }));
    for (const r of results) {
      if (!r) continue;
      if (vagaTemQualidade(r)) vagas.push(r);
      else descartadas++;
    }
    console.log(`[${nome}] Fase 2: ${vagas.length} ok, ${descartadas} descartadas (baixa qualidade)`);
    if (i + BATCH < urls.length) await sleep(400);
  }
  if (vagas.length === 0) {
    const fromListing = extractVagasFromListing(html, url, nome, maxVagas);
    if (fromListing.length > 0) {
      console.log(`[${nome}] Fallback listagem apos falha no detalhe: ${fromListing.length} vagas`);
      return { vagas: fromListing, erro: null, descartadas };
    }
  }
  return { vagas, erro: null, descartadas };
};

const dedupeKey = (v: { titulo?: string | null; empresa?: string | null; url_origem?: string | null }) => {
  const url = (v.url_origem || "").trim().toLowerCase();
  if (url) return `url:${url}`;
  return `te:${norm(v.titulo || "")}|${norm(v.empresa || "")}`;
};

// ============================================================
// HANDLER PRINCIPAL
// ============================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });

  let body: RequestBody;
  try { body = await req.json(); }
  catch {
    return new Response(JSON.stringify({ error: "Body JSON invalido" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { cidade_id, sites = [], max_vagas = 30 } = body;
  if (!cidade_id) {
    return new Response(JSON.stringify({ error: "cidade_id obrigatorio" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: db } = await supabase
    .from("cidade_scraping_emprego_fonte")
    .select("url, nome")
    .eq("cidade_id", cidade_id).eq("ativo", true);
  const dbMap = new Map((db || []).map((f: { url: string; nome: string }) => [f.url, f.nome]));

  let fontes: Array<{ url: string; nome: string }> = [];
  if (sites.length > 0) {
    fontes = sites.map((u: string) => ({ url: u, nome: dbMap.get(u) || u }));
  } else {
    fontes = (db || []) as Array<{ url: string; nome: string }>;
  }

  if (!fontes.length) {
    return new Response(JSON.stringify({ error: "Nenhuma fonte ativa." }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { data: existentes } = await supabase
    .from("vagas_emprego_scraping")
    .select("titulo, empresa, url_origem")
    .eq("cidade_id", cidade_id)
    .order("created_at", { ascending: false })
    .limit(5000);

  const keysExistentes = new Set(
    (existentes || []).map((v: { titulo: string | null; empresa: string | null; url_origem: string | null }) =>
      dedupeKey(v)
    )
  );

  const erros: Record<string, string> = {};
  let totalEncontradas = 0;
  let totalInseridas = 0;
  let totalDescartadas = 0;
  let totalDuplicadas = 0;

  for (const { url, nome } of fontes) {
    const { vagas, erro, descartadas } = await scrapeSite(url, nome, max_vagas);
    totalDescartadas += descartadas;
    if (erro) { erros[nome] = erro; continue; }
    totalEncontradas += vagas.length;
    if (!vagas.length) {
      if (descartadas > 0) erros[nome] = `${descartadas} vagas descartadas por baixa qualidade`;
      continue;
    }
    const novas = vagas.filter((v) => {
      const key = dedupeKey(v);
      if (keysExistentes.has(key)) {
        totalDuplicadas++;
        return false;
      }
      keysExistentes.add(key);
      return true;
    });

    for (let j = 0; j < novas.length; j += 50) {
      const chunk = novas.slice(j, j + 50).map(v => ({
        ...v,
        cidade_id,
        processado_texto_02: false,
        publicado_em_vagas: false,
        status_fluxo: "coletada",
        texto_02_processado_at: null,
        publicado_em_vagas_at: null,
      }));
      const { error } = await supabase.from("vagas_emprego_scraping").insert(chunk);
      if (!error) totalInseridas += chunk.length;
      else console.error("insert error:", error.message);
    }
  }

  return new Response(
    JSON.stringify({
      ok: true,
      cidade_id,
      fontes_varridas: fontes.length,
      vagas_encontradas: totalEncontradas,
      vagas_inseridas: totalInseridas,
      vagas_duplicadas: totalDuplicadas,
      vagas_descartadas: totalDescartadas,
      erros: Object.keys(erros).length ? erros : undefined,
    }),
    { headers: { ...CORS, "Content-Type": "application/json" } }
  );
});
