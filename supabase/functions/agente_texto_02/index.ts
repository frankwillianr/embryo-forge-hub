import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LIMIT_DEFAULT = 30;
const LIMIT_MAX = 150;
const MODEL_DEFAULT = "gpt-4o-mini";
const CONCURRENCY = 3;

interface RequestBody {
  cidade_id: string;
  limit?: number;
}

interface NoticiaInput {
  id: string;
  cidade_id: string;
  url: string;
  titulo: string | null;
  descricao: string | null;
  fonte_nome: string | null;
  status: "coletado" | "processando" | "processado" | "erro";
  created_at: string;
  titulo_original?: string | null;
  descricao_original?: string | null;
}

interface RewriteResult {
  titulo_reescrito: string;
  descricao_reescrita: string;
  texto_reescrito: string;
}

interface ProcessItem {
  id: string;
  ok: boolean;
  erro?: string;
  titulo_reescrito?: string;
}

function stripHtml(raw: string | null | undefined): string {
  return (raw ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildPrompt(n: NoticiaInput): string {
  return `Você é o Agente de Texto 02, redator sênior de notícias, especialista em linguagem popular e voz do povo.

Sua tarefa é pegar a notícia abaixo (vinda do Agente Buscador) e reescrever mantendo fidelidade total aos fatos, com texto curto e fácil de ler.

OBJETIVO
- Criar título forte, viral e com apelo de clique (clickbait responsável), sem mentir.
- Criar descrição resumida em 2 parágrafos curtos, com início, meio e fim.
- Criar texto curto em 3 a 6 parágrafos curtos (até 900 caracteres).

REGRAS OBRIGATÓRIAS
- Nunca inventar informação.
- Não alterar nomes, números, datas, locais ou cargos.
- Não incluir opinião pessoal.
- Não criar fatos ausentes no texto original.
- Se faltar dado, não invente.

ESTILO
- Português do Brasil.
- Tom jornalístico popular, direto e humano.
- Frases simples, sem enrolação.

NOTÍCIA DE ENTRADA
ID: ${n.id}
URL: ${n.url}
FONTE: ${n.fonte_nome ?? ""}
TÍTULO ORIGINAL: ${stripHtml(n.titulo)}
DESCRIÇÃO ORIGINAL: ${stripHtml(n.descricao)}

Responda SOMENTE JSON válido no formato:
{
  "titulo_reescrito": "string",
  "descricao_reescrita": "string",
  "texto_reescrito": "string"
}`;
}

async function rewriteWithAI(
  n: NoticiaInput,
  apiKey: string,
  model: string
): Promise<RewriteResult> {
  const prompt = buildPrompt(n);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${txt.slice(0, 800)}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenAI sem conteúdo");

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Falha ao parsear JSON da IA");
    parsed = JSON.parse(m[0]);
  }

  const titulo = stripHtml(parsed?.titulo_reescrito);
  const descricao = stripHtml(parsed?.descricao_reescrita);
  const texto = stripHtml(parsed?.texto_reescrito);

  if (!titulo || !descricao || !texto) {
    throw new Error("Resposta da IA incompleta");
  }

  return {
    titulo_reescrito: titulo,
    descricao_reescrita: descricao,
    texto_reescrito: texto,
  };
}

async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const cidade_id = body?.cidade_id;
    const limit = Math.min(Math.max(body?.limit ?? LIMIT_DEFAULT, 1), LIMIT_MAX);

    if (!cidade_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "cidade_id obrigatorio" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "OPENAI_API_KEY ausente nos secrets" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    const model = Deno.env.get("AGENTE_TEXTO_02_MODEL") ?? MODEL_DEFAULT;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("tabela_agente_buscador")
      .select("id, cidade_id, url, titulo, descricao, fonte_nome, status, created_at, titulo_original, descricao_original")
      .eq("cidade_id", cidade_id)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const noticias = (data ?? []) as NoticiaInput[];
    if (!noticias.length) {
      return new Response(
        JSON.stringify({
          ok: true,
          agente: "agente_texto_02",
          cidade_id,
          total_entrada: 0,
          total_processado: 0,
          itens: [],
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Marca lote como processando
    await supabase
      .from("tabela_agente_buscador")
      .update({ status: "processando" })
      .in("id", noticias.map((n) => n.id));

    const items: ProcessItem[] = [];
    const tasks = noticias.map((n) => async () => {
      const rewritten = await rewriteWithAI(n, openaiKey, model);

      const payload = {
        titulo_original: n.titulo_original ?? n.titulo,
        descricao_original: n.descricao_original ?? n.descricao,
        titulo_reescrito: rewritten.titulo_reescrito,
        descricao_reescrita: rewritten.descricao_reescrita,
        texto_reescrito: rewritten.texto_reescrito,
        // Atualiza os campos principais para o app já consumir a versão nova
        titulo: rewritten.titulo_reescrito,
        descricao: rewritten.descricao_reescrita,
        status: "processado",
        agente_texto_updated_at: new Date().toISOString(),
      };

      const { error: updErr } = await supabase
        .from("tabela_agente_buscador")
        .update(payload)
        .eq("id", n.id);

      if (updErr) throw new Error(`Update ${n.id}: ${updErr.message}`);

      const result: ProcessItem = {
        id: n.id,
        ok: true,
        titulo_reescrito: rewritten.titulo_reescrito,
      };
      items.push(result);
      return result;
    });

    const settled = await runConcurrent(tasks, CONCURRENCY);

    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === "rejected") {
        const n = noticias[i];
        const errMsg = String(r.reason);
        items.push({ id: n.id, ok: false, erro: errMsg });
        await supabase
          .from("tabela_agente_buscador")
          .update({ status: "erro" })
          .eq("id", n.id);
      }
    }

    const total_processado = items.filter((i) => i.ok).length;
    const total_erros = items.length - total_processado;

    return new Response(
      JSON.stringify({
        ok: true,
        agente: "agente_texto_02",
        cidade_id,
        model,
        total_entrada: noticias.length,
        total_processado,
        total_erros,
        itens: items,
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
