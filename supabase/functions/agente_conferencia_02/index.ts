import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LIMIT_DEFAULT = 200;
const LIMIT_MAX = 400;
const MAX_DAY_DIFF = 5;

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
  titleNorm: string;
  textNorm: string;
  titleTokens: Set<string>;
  textTokens: Set<string>;
  urlTokens: Set<string>;
  numbers: Set<string>;
}

interface DuplicateEdge {
  i: number;
  j: number;
  score: number;
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

const STOPWORDS = new Set([
  "de","da","do","das","dos","a","o","as","os","e","em","no","na","nos","nas",
  "um","uma","uns","umas","por","para","com","sem","ao","aos","a","as","que",
  "se","sob","sobre","entre","apos","mais","menos","ja","foi","ser","sao","como",
  "dos","das","pela","pelo","pelos","pelas","nosso","nossa","seu","sua","suas",
  "apos","durante","nesta","neste","nestas","nestes","essa","esse","isso","esta",
  "este","isso","tambem","muito","pouco","onde","quando","contra","sobre",
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
    const descNorm = normalizeText(r.descricao).slice(0, 1600);
    const textNorm = `${titleNorm} ${descNorm}`.trim();
    const dateBase = r.data_publicacao ? `${r.data_publicacao}T00:00:00.000Z` : r.created_at;
    return {
      ...r,
      idx,
      dateEpochDay: epochDay(dateBase),
      titleNorm,
      textNorm,
      titleTokens: tokenize(titleNorm),
      textTokens: tokenize(textNorm),
      urlTokens: tokensFromUrl(r.url),
      numbers: extractNumbers(textNorm),
    };
  });
}

function comparePair(a: Prepared, b: Prepared): DuplicateEdge | null {
  const dayDiff = Math.abs(a.dateEpochDay - b.dateEpochDay);
  if (dayDiff > MAX_DAY_DIFF) return null;

  const titleSim = jaccard(a.titleTokens, b.titleTokens);
  const textSim = jaccard(a.textTokens, b.textTokens);
  const urlSim = jaccard(a.urlTokens, b.urlTokens);
  const numberSim = jaccard(a.numbers, b.numbers);

  const score = titleSim * 0.4 + textSim * 0.45 + urlSim * 0.1 + numberSim * 0.05;
  const hardDuplicate =
    (textSim >= 0.72 && titleSim >= 0.42) ||
    (titleSim >= 0.82 && textSim >= 0.35) ||
    (urlSim >= 0.7 && textSim >= 0.45);

  if (!hardDuplicate && score < 0.66) return null;

  return {
    i: a.idx,
    j: b.idx,
    score,
    reason: `title=${titleSim.toFixed(2)} text=${textSim.toFixed(2)} url=${urlSim.toFixed(2)} nums=${numberSim.toFixed(2)}`,
  };
}

function chooseCanonical(group: Prepared[]): Prepared {
  const sorted = [...group].sort((a, b) => {
    const aLen = (a.descricao?.length ?? 0) + (a.titulo?.length ?? 0) * 2 + (a.lista_imagens?.length ?? 0) * 40;
    const bLen = (b.descricao?.length ?? 0) + (b.titulo?.length ?? 0) * 2 + (b.lista_imagens?.length ?? 0) * 40;
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

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("tabela_agente_buscador")
      .select("id, cidade_id, url, titulo, descricao, lista_imagens, fonte_nome, data_publicacao, created_at")
      .eq("cidade_id", cidade_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data ?? []) as NoticiaRow[];
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
          itens: [],
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const prepared = buildPrepared(rows);
    const edges: DuplicateEdge[] = [];

    for (let i = 0; i < prepared.length; i++) {
      for (let j = i + 1; j < prepared.length; j++) {
        const e = comparePair(prepared[i], prepared[j]);
        if (e) edges.push(e);
      }
    }

    const dsu = new DSU(prepared.length);
    for (const e of edges) dsu.union(e.i, e.j);

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
      const groupEdges = edges.filter((e) => groupSet.has(e.i) && groupSet.has(e.j));
      const maxScore = groupEdges.length
        ? Math.max(...groupEdges.map((e) => e.score))
        : 0.66;
      const reason = groupEdges[0]?.reason ?? "similaridade semantica";

      for (const n of group) {
        const isDup = n.id !== canonical.id;
        if (isDup) duplicateIds.add(n.id);

        const payload = {
          is_duplicada: isDup,
          noticia_canonica_id: isDup ? canonical.id : null,
          conferencia_score: Number(maxScore.toFixed(4)),
          conferencia_motivo: isDup ? reason : "noticia canonica",
          conferencia_updated_at: new Date().toISOString(),
        };

        const { error: updErr } = await supabase
          .from("tabela_agente_buscador")
          .update(payload)
          .eq("id", n.id);

        if (updErr) throw new Error(`Falha update ${n.id}: ${updErr.message}`);
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

    return new Response(
      JSON.stringify({
        ok: true,
        agente: "agente_conferencia_02",
        cidade_id,
        total_entrada: rows.length,
        grupos_duplicados: groups.length,
        total_duplicadas: duplicateIds.size,
        total_canonicas: rows.length - duplicateIds.size,
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
