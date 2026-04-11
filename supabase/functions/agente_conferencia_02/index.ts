import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LIMIT_DEFAULT = 200;
const LIMIT_MAX = 400;
const MAX_DAY_DIFF_RULE = 10;
const MAX_DAY_DIFF_AI = 45;
const AI_MODEL_DEFAULT = "gpt-4o-mini";
const AI_MAX_PAIRS = 350;
const AI_MIN_CONFIDENCE = 0.58;
const AI_EVAL_BUDGET_MS = 50_000;
const CITY_RELEVANCIA_CONCURRENCY = 8;

interface RequestBody {
  cidade_id: string;
  limit?: number;
}

interface NoticiaRow {
  id: string;
  cidade_id: string;
  url: string;
  titulo: string | null;
  descricao: string | null;
  lista_imagens: string[] | null;
  fonte_nome: string | null;
  data_publicacao: string | null;
  created_at: string;
}

interface Prepared extends NoticiaRow {
  idx: number;
  dateEpochDay: number;
  hasExplicitDate: boolean;
  titleNorm: string;
  textNorm: string;
  titleTokens: Set<string>;
  textTokens: Set<string>;
  urlTokens: Set<string>;
  numbers: Set<string>;
}

interface PairMetrics {
  i: number;
  j: number;
  dayDiff: number;
  titleSim: number;
  textSim: number;
  urlSim: number;
  numberSim: number;
  score: number;
}

interface DuplicateEdge {
  i: number;
  j: number;
  score: number;
  reason: string;
  metodo: "regra" | "ia";
}

interface IaDecision {
  duplicate: boolean;
  confidence: number;
  reason: string;
}

function normalizeText(raw: string | null | undefined): string {
  return (raw ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&nbsp;|&#\d+;/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function hasPhrase(textNorm: string, phraseNorm: string): boolean {
  if (!phraseNorm) return false;
  return (` ${textNorm} `).includes(` ${phraseNorm} `);
}

function cityHeuristicRelevante(
  noticia: NoticiaRow,
  nomeCidade: string,
  slugCidade: string | null,
): boolean {
  const corpus = normalizeText(`${noticia.url} ${noticia.titulo ?? ""} ${noticia.descricao ?? ""}`);
  const cidadeNorm = normalizeText(nomeCidade);
  const slugNorm = normalizeText((slugCidade ?? "").replace(/-/g, " "));
  if (cidadeNorm && hasPhrase(corpus, cidadeNorm)) return true;
  if (slugNorm && hasPhrase(corpus, slugNorm)) return true;

  const tokens = cidadeNorm.split(" ").filter((t) => t.length >= 4);
  const hits = tokens.filter((t) => hasPhrase(corpus, t)).length;
  return hits >= 2;
}

const STOPWORDS = new Set([
  "de", "da", "do", "das", "dos", "a", "o", "as", "os", "e", "em", "no", "na", "nos", "nas",
  "um", "uma", "uns", "umas", "por", "para", "com", "sem", "ao", "aos", "que", "se", "sob", "sobre",
  "entre", "apos", "mais", "menos", "ja", "foi", "ser", "sao", "como", "pela", "pelo", "pelos", "pelas",
  "nesta", "neste", "nestas", "nestes", "essa", "esse", "isso", "esta", "este", "tambem", "muito", "pouco",
  "onde", "quando", "contra", "obras", "obra", "noticia", "governador", "valadares",
]);

function tokenize(raw: string): Set<string> {
  const set = new Set<string>();
  for (const part of raw.split(/\s+/)) {
    if (!part || part.length < 3) continue;
    if (STOPWORDS.has(part)) continue;
    set.add(part);
  }
  return set;
}

function tokensFromUrl(rawUrl: string): Set<string> {
  try {
    const u = new URL(rawUrl);
    const merged = `${u.hostname} ${u.pathname}`
      .replace(/[-_/]/g, " ")
      .replace(/\.\w+$/g, " ");
    return tokenize(normalizeText(merged));
  } catch {
    return new Set();
  }
}

function extractNumbers(raw: string): Set<string> {
  const set = new Set<string>();
  const m = raw.match(/\b\d{1,6}\b/g) ?? [];
  for (const n of m) set.add(n);
  return set;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const uni = a.size + b.size - inter;
  return uni > 0 ? inter / uni : 0;
}

function epochDay(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor(d.getTime() / 86_400_000);
}

class DSU {
  parent: number[];
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i);
  }
  find(x: number): number {
    if (this.parent[x] !== x) this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  union(a: number, b: number): void {
    const ra = this.find(a);
    const rb = this.find(b);
    if (ra !== rb) this.parent[rb] = ra;
  }
}

function buildPrepared(rows: NoticiaRow[]): Prepared[] {
  return rows.map((r, idx) => {
    const titleNorm = normalizeText(r.titulo);
    const descNorm = normalizeText(r.descricao).slice(0, 1800);
    const textNorm = `${titleNorm} ${descNorm}`.trim();
    const dateBase = r.data_publicacao ? `${r.data_publicacao}T00:00:00.000Z` : r.created_at;
    return {
      ...r,
      idx,
      dateEpochDay: epochDay(dateBase),
      hasExplicitDate: Boolean(r.data_publicacao),
      titleNorm,
      textNorm,
      titleTokens: tokenize(titleNorm),
      textTokens: tokenize(textNorm),
      urlTokens: tokensFromUrl(r.url),
      numbers: extractNumbers(textNorm),
    };
  });
}

function computeMetrics(a: Prepared, b: Prepared): PairMetrics | null {
  const dayDiff = Math.abs(a.dateEpochDay - b.dateEpochDay);
  if (dayDiff > MAX_DAY_DIFF_AI) return null;

  const titleSim = jaccard(a.titleTokens, b.titleTokens);
  const textSim = jaccard(a.textTokens, b.textTokens);
  const urlSim = jaccard(a.urlTokens, b.urlTokens);
  const numberSim = jaccard(a.numbers, b.numbers);
  const score = titleSim * 0.35 + textSim * 0.5 + urlSim * 0.1 + numberSim * 0.05;

  return { i: a.idx, j: b.idx, dayDiff, titleSim, textSim, urlSim, numberSim, score };
}

function deterministicDuplicate(m: PairMetrics): DuplicateEdge | null {
  if (m.dayDiff > MAX_DAY_DIFF_RULE) return null;
  const strong =
    (m.textSim >= 0.80 && m.titleSim >= 0.48) ||
    (m.titleSim >= 0.90 && m.textSim >= 0.35) ||
    (m.urlSim >= 0.82 && m.textSim >= 0.50);

  if (!strong) return null;

  return {
    i: m.i,
    j: m.j,
    score: m.score,
    reason: `regra: title=${m.titleSim.toFixed(2)} text=${m.textSim.toFixed(2)} url=${m.urlSim.toFixed(2)} nums=${m.numberSim.toFixed(2)}`,
    metodo: "regra",
  };
}

function shouldReviewWithAi(m: PairMetrics, a: Prepared, b: Prepared): boolean {
  if (m.dayDiff > MAX_DAY_DIFF_AI) return false;

  // Portais diferentes reescrevem a mesma notícia com vocabulário diferente,
  // então a similaridade léxica cai naturalmente. Usamos um threshold menor
  // para garantir que esses pares cheguem ao AI.
  const differentFonte =
    Boolean(a.fonte_nome) && Boolean(b.fonte_nome) && a.fonte_nome !== b.fonte_nome;

  if (differentFonte) {
    const crossPortalCandidate =
      (m.titleSim >= 0.10 && m.textSim >= 0.10) ||
      m.textSim >= 0.18 ||
      m.titleSim >= 0.22 ||
      (m.numberSim >= 0.50 && m.textSim >= 0.10) ||
      m.score >= 0.18;
    if (crossPortalCandidate) return true;
  }

  const lexicalLikely =
    (m.titleSim >= 0.18 && m.textSim >= 0.16) ||
    m.textSim >= 0.26 ||
    m.titleSim >= 0.32 ||
    (m.numberSim >= 0.60 && m.textSim >= 0.18) ||
    m.score >= 0.28;

  return lexicalLikely;
}

function short(text: string | null | undefined, max = 1300): string {
  const t = normalizeText(text).replace(/\s{2,}/g, " ").trim();
  return t.slice(0, max);
}

async function decideWithAi(
  a: Prepared,
  b: Prepared,
  apiKey: string,
  model: string,
): Promise<IaDecision | null> {
  const sameFonte = a.fonte_nome && b.fonte_nome && a.fonte_nome === b.fonte_nome;
  const prompt = `Voce e um classificador de duplicidade de noticias locais.

REGRA PRINCIPAL: Se as duas noticias descrevem o MESMO FATO ou EVENTO especifico, sao DUPLICADAS — independente de virem de portais diferentes, terem titulos reescritos ou textos com palavras distintas. Portais diferentes frequentemente cobrem a mesma noticia com texto proprio: isso e DUPLICATA.

Definicao de DUPLICADA:
- Mesmo fato/evento especifico, mesmo local, mesma data aproximada.
- Podem ter titulos diferentes, textos reescritos, fontes diferentes — nao importa, se e o mesmo acontecimento, e DUPLICATA.
- Exemplos: acidente na mesma rua no mesmo dia, mesma inauguracao, mesmo crime, mesmo resultado de licitacao.

Definicao de NAO DUPLICADA:
- Mesmo tema recorrente mas ocorrencias distintas (ex: obras na BR-381 em semanas diferentes descrevendo etapas diferentes).
- Atualizacoes sequenciais de um fato ja reportado com novas informacoes relevantes.
- Eventos similares mas em datas, locais ou contextos claramente diferentes.

${sameFonte ? "" : "ATENCAO: As noticias sao de PORTAIS DIFERENTES. Isso e comum — o mesmo fato e publicado por varios portais com texto proprio. Avalie pelo CONTEUDO do fato, nao pela semelhanca textual.\n"}
Responda APENAS JSON valido:
{
  "duplicate": true|false,
  "confidence": 0.0-1.0,
  "reason": "curto"
}

Noticia A:
- fonte: ${a.fonte_nome ?? ""}
- data: ${a.data_publicacao ?? ""}
- url: ${a.url}
- titulo: ${short(a.titulo, 300)}
- texto: ${short(a.descricao, 1200)}

Noticia B:
- fonte: ${b.fonte_nome ?? ""}
- data: ${b.data_publicacao ?? ""}
- url: ${b.url}
- titulo: ${short(b.titulo, 300)}
- texto: ${short(b.descricao, 1200)}
`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 180,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) return null;
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    parsed = JSON.parse(m[0]);
  }

  const duplicate = Boolean(parsed?.duplicate);
  const confidenceRaw = Number(parsed?.confidence ?? 0);
  const confidence = Number.isFinite(confidenceRaw) ? Math.max(0, Math.min(1, confidenceRaw)) : 0;
  const reason = String(parsed?.reason ?? "").slice(0, 220);

  return { duplicate, confidence, reason };
}

async function checkRelevanciaComCidade(
  noticia: NoticiaRow,
  nomeCidade: string,
  slugCidade: string | null,
  apiKey: string,
  model: string,
): Promise<boolean> {
  if (!apiKey) {
    return cityHeuristicRelevante(noticia, nomeCidade, slugCidade);
  }

  const prompt = `Esta noticia e da cidade de "${nomeCidade}"?

Titulo: ${(noticia.titulo ?? "").slice(0, 300)}
Texto: ${(noticia.descricao ?? "").slice(0, 800)}

Responda true se o fato descrito aconteceu em "${nomeCidade}".
Responda false se o fato aconteceu em outra cidade ou nao tem relacao direta com "${nomeCidade}".

Responda APENAS JSON valido:
{
  "relevante": true|false,
  "confidence": 0.0-1.0,
  "reason": "curto"
}`;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 120,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) return cityHeuristicRelevante(noticia, nomeCidade, slugCidade);
  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) return cityHeuristicRelevante(noticia, nomeCidade, slugCidade);

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return cityHeuristicRelevante(noticia, nomeCidade, slugCidade);
    try { parsed = JSON.parse(m[0]); } catch { return cityHeuristicRelevante(noticia, nomeCidade, slugCidade); }
  }

  if (parsed?.relevante === false) return false;
  if (parsed?.relevante === true) return true;
  return cityHeuristicRelevante(noticia, nomeCidade, slugCidade);
}

function chooseCanonical(group: Prepared[]): Prepared {
  const sorted = [...group].sort((a, b) => {
    const aLen = (a.descricao?.length ?? 0) + (a.titulo?.length ?? 0) * 2 + (a.lista_imagens?.length ?? 0) * 50;
    const bLen = (b.descricao?.length ?? 0) + (b.titulo?.length ?? 0) * 2 + (b.lista_imagens?.length ?? 0) * 50;
    if (bLen !== aLen) return bLen - aLen;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
  return sorted[0];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = (await req.json()) as RequestBody;
    const cidade_id = body?.cidade_id;
    const limit = Math.min(Math.max(body?.limit ?? LIMIT_DEFAULT, 20), LIMIT_MAX);

    if (!cidade_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "cidade_id obrigatorio" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    const aiEnabled = Boolean(openaiKey);
    const aiModel = Deno.env.get("AGENTE_CONFERENCIA_02_MODEL") ?? AI_MODEL_DEFAULT;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: cidadeRow, error: cidadeErr } = await supabase
      .from("cidade")
      .select("nome, slug")
      .eq("id", cidade_id)
      .maybeSingle();
    if (cidadeErr) throw cidadeErr;
    const nomeCidade: string = cidadeRow?.nome ?? "";
    const slugCidade: string | null = cidadeRow?.slug ?? null;

    const { data, error } = await supabase
      .from("tabela_agente_buscador")
      .select("id, cidade_id, url, titulo, descricao, lista_imagens, fonte_nome, data_publicacao, created_at")
      .eq("cidade_id", cidade_id)
      .order("data_publicacao", { ascending: false, nullsFirst: false })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    let rows = (data ?? []) as NoticiaRow[];
    let total_irrelevantes = 0;

    if (nomeCidade && rows.length) {
            const irrelevantesIds: string[] = [];

      for (let i = 0; i < rows.length; i += CITY_RELEVANCIA_CONCURRENCY) {
        const batch = rows.slice(i, i + CITY_RELEVANCIA_CONCURRENCY);
        const results = await Promise.all(
          batch.map((r) => checkRelevanciaComCidade(r, nomeCidade, slugCidade, openaiKey, aiModel))
        );
        for (let k = 0; k < batch.length; k++) {
          if (!results[k]) irrelevantesIds.push(batch[k].id);
        }
      }

      if (irrelevantesIds.length) {
        const CHUNK = 100;
        for (let i = 0; i < irrelevantesIds.length; i += CHUNK) {
          const slice = irrelevantesIds.slice(i, i + CHUNK);
          await supabase.from("tabela_agente_buscador").delete().in("id", slice);
        }
        rows = rows.filter((r) => !irrelevantesIds.includes(r.id));
        total_irrelevantes = irrelevantesIds.length;
      }
    }

    if (!rows.length) {
      return new Response(
        JSON.stringify({
          ok: true,
          agente: "agente_conferencia_02",
          cidade_id,
          total_entrada: 0,
          total_duplicadas: 0,
          grupos_duplicados: 0,
          total_canonicas: 0,
          ia_habilitada: aiEnabled,
          ia_avaliados: 0,
          itens: [],
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const prepared = buildPrepared(rows);
    const edges: DuplicateEdge[] = [];
    const aiCandidates: PairMetrics[] = [];

    for (let i = 0; i < prepared.length; i++) {
      for (let j = i + 1; j < prepared.length; j++) {
        const m = computeMetrics(prepared[i], prepared[j]);
        if (!m) continue;

        const hard = deterministicDuplicate(m);
        if (hard) {
          edges.push(hard);
          continue;
        }

        if (shouldReviewWithAi(m, prepared[i], prepared[j])) aiCandidates.push(m);
      }
    }

    let iaAvaliados = 0;
    let iaInterrompidoPorTempo = false;
    if (aiEnabled && aiCandidates.length) {
      aiCandidates.sort((a, b) => b.score - a.score || a.dayDiff - b.dayDiff);
      const picked = aiCandidates.slice(0, AI_MAX_PAIRS);
      const aiStartedAt = Date.now();

      for (const m of picked) {
        if (Date.now() - aiStartedAt >= AI_EVAL_BUDGET_MS) {
          iaInterrompidoPorTempo = true;
          break;
        }
        const a = prepared[m.i];
        const b = prepared[m.j];
        const decision = await decideWithAi(a, b, openaiKey, aiModel);
        iaAvaliados++;
        if (!decision) continue;
        if (!decision.duplicate) continue;
        if (decision.confidence < AI_MIN_CONFIDENCE) continue;
        // Guarda de seguranca: se ambas tem data explicita e a diferenca e grande,
        // so aceita duplicidade com confianca muito alta + similaridade textual relevante.
        if (
          a.hasExplicitDate &&
          b.hasExplicitDate &&
          m.dayDiff >= 8 &&
          !(decision.confidence >= 0.9 && m.textSim >= 0.45)
        ) {
          continue;
        }

        edges.push({
          i: m.i,
          j: m.j,
          score: Math.max(m.score, decision.confidence),
          reason: `ia(${decision.confidence.toFixed(2)}): ${decision.reason || "mesmo fato"}`,
          metodo: "ia",
        });
      }
    }

    const edgeMap = new Map<string, DuplicateEdge>();
    for (const e of edges) {
      const key = e.i < e.j ? `${e.i}-${e.j}` : `${e.j}-${e.i}`;
      const prev = edgeMap.get(key);
      if (!prev || e.score > prev.score) edgeMap.set(key, e);
    }
    const finalEdges = [...edgeMap.values()];

    const dsu = new DSU(prepared.length);
    for (const e of finalEdges) dsu.union(e.i, e.j);

    const groupsMap = new Map<number, Prepared[]>();
    for (const item of prepared) {
      const r = dsu.find(item.idx);
      const arr = groupsMap.get(r) ?? [];
      arr.push(item);
      groupsMap.set(r, arr);
    }

    const groups = [...groupsMap.values()].filter((g) => g.length > 1);
    const duplicateIds = new Set<string>();
    const outputItems: Array<Record<string, unknown>> = [];

    for (const group of groups) {
      const canonical = chooseCanonical(group);
      const groupSet = new Set(group.map((g) => g.idx));
      const groupEdges = finalEdges.filter((e) => groupSet.has(e.i) && groupSet.has(e.j));
      const maxScore = groupEdges.length ? Math.max(...groupEdges.map((e) => e.score)) : 0.66;
      const reason = groupEdges[0]?.reason ?? "similaridade semantica";

      for (const n of group) {
        if (n.id !== canonical.id) duplicateIds.add(n.id);
      }

      const { error: canonicalUpdErr } = await supabase
        .from("tabela_agente_buscador")
        .update({
          is_duplicada: false,
          noticia_canonica_id: null,
          conferencia_score: Number(maxScore.toFixed(4)),
          conferencia_motivo: "noticia canonica",
          conferencia_updated_at: new Date().toISOString(),
        })
        .eq("id", canonical.id);
      if (canonicalUpdErr) {
        throw new Error(`Falha update canonica ${canonical.id}: ${canonicalUpdErr.message}`);
      }

      outputItems.push({
        canonica_id: canonical.id,
        grupo_qtd: group.length,
        score: Number(maxScore.toFixed(4)),
        urls: group.map((g) => g.url),
      });
    }

    const canonicaIds = rows
      .filter((r) => !duplicateIds.has(r.id))
      .map((r) => r.id);

    if (canonicaIds.length) {
      await supabase
        .from("tabela_agente_buscador")
        .update({
          is_duplicada: false,
          noticia_canonica_id: null,
          conferencia_motivo: "noticia unica",
          conferencia_updated_at: new Date().toISOString(),
        })
        .in("id", canonicaIds);
    }

    const duplicateIdList = [...duplicateIds];
    if (duplicateIdList.length) {
      const CHUNK = 100;
      for (let i = 0; i < duplicateIdList.length; i += CHUNK) {
        const slice = duplicateIdList.slice(i, i + CHUNK);
        const { error: delErr } = await supabase
          .from("tabela_agente_buscador")
          .delete()
          .in("id", slice);
        if (delErr) throw new Error(`Falha ao deletar duplicadas: ${delErr.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        agente: "agente_conferencia_02",
        cidade_id,
        total_entrada: rows.length,
        grupos_duplicados: groups.length,
        total_duplicadas: duplicateIds.size,
        total_deletadas: duplicateIds.size,
        total_irrelevantes,
        total_canonicas: rows.length - duplicateIds.size,
        ia_habilitada: aiEnabled,
        ia_avaliados: iaAvaliados,
        ia_candidatos: aiCandidates.length,
        ia_interrompido_por_tempo: iaInterrompidoPorTempo,
        itens: outputItems,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});






