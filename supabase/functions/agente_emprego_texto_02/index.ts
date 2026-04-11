import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIMIT_DEFAULT = 40;
const LIMIT_MAX = 200;
const CONCURRENCY = 3;
const MODEL_DEFAULT = "gpt-4o-mini";

interface RequestBody {
  cidade_id: string;
  limit?: number;
}

interface VagaRow {
  id: string;
  cidade_id: string;
  titulo: string | null;
  empresa: string | null;
  descricao: string | null;
  area: string | null;
  tipo_contrato: string | null;
  salario: string | null;
  local_vaga: string | null;
  contato: string | null;
  status_fluxo: string | null;
  publicado_em_vagas: boolean | null;
}

interface ProcessItem {
  id: string;
  ok: boolean;
  erro?: string;
}

const stripText = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();

const norm = (value: string | null | undefined) =>
  stripText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const sanitizeSalario = (raw: string | null | undefined): string | null => {
  const cleaned = stripText(raw).replace(/[;.,]+$/g, "").trim();
  if (!cleaned) return null;

  const n = norm(cleaned);
  const badTokens = new Set([
    "blog",
    "mercado",
    "home",
    "inicio",
    "menu",
    "vagas",
    "empregos",
    "contato",
    "cadastro",
    "login",
    "termos",
    "politica",
  ]);
  if (badTokens.has(n)) return null;

  // Regra de negocio: so aceita salario com valor monetario objetivo.
  const withCurrency = cleaned.match(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (withCurrency) return `R$ ${withCurrency[1]}`;

  const plainNumberMatch = cleaned.match(/\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/);
  if (plainNumberMatch) return `R$ ${plainNumberMatch[1]}`;

  return null;
};

const extractSalarioFromText = (text: string | null | undefined): string | null => {
  const source = text ?? "";
  if (!source.trim()) return null;

  const labelMatch = source.match(/sal[aá]rio[^:\n]{0,20}[:\-\s]+([^\n]{2,100})/i);
  if (labelMatch) {
    const v = sanitizeSalario(labelMatch[1]);
    if (v) return v;
  }

  const currencyMatch = source.match(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/i);
  if (currencyMatch) {
    const v = sanitizeSalario(currencyMatch[0]);
    if (v) return v;
  }

  const plainNumberMatch = source.match(/\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/);
  if (plainNumberMatch) {
    const v = sanitizeSalario(`R$ ${plainNumberMatch[1]}`);
    if (v) return v;
  }

  return null;
};

const normalizeParagraphText = (value: string | null | undefined) =>
  (value ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();

const removePromptLeak = (value: string): string => {
  const idx = value.toLowerCase().indexOf("dados da vaga:");
  if (idx >= 0) return value.slice(0, idx).trim();
  return value.trim();
};

const formatSectionHeadingsBold = (value: string): string => {
  let text = value;
  text = text.replace(/^\**\s*Resumo da vaga\s*:\**\s*/gim, "**Resumo da vaga:**\n");
  text = text.replace(/^\**\s*Requisitos\s*:\**\s*/gim, "**Requisitos:**\n");
  text = text.replace(/^\**\s*Benef[ií]cios\s*:\**\s*/gim, "**Benefícios:**\n");
  text = text.replace(/^\**\s*Como se candidatar\s*:\**\s*/gim, "**Como se candidatar:**\n");
  text = text.replace(/\n{3,}/g, "\n\n");
  return text.trim();
};

const buildPrompt = (vaga: VagaRow): string => {
  return `vc trabalha explicando vagas para o cliente crie uma descrição com todos detalhes mas facil de ler, organizado com paragrafos deixando a leitura resumida e objetiva

Regras:
- Não invente informações.
- Use só os dados fornecidos.
- Se algum dado não existir, não mencione.
- Escreva em português do Brasil.
- Texto final curto e claro (entre 500 e 1200 caracteres quando possível).
- Não use markdown (sem **, sem #, sem listas com traço).
- Organize em parágrafos curtos com linha em branco entre eles.
- Sempre inclua um parágrafo final de "Como se candidatar" quando houver contato.
- Use negrito APENAS nos títulos das seções.
- Use exatamente este template de saída, nesta ordem:
**Resumo da vaga:**
[1 parágrafo objetivo com cargo, empresa, local e tipo de contrato]

**Requisitos:**
[1 parágrafo curto com requisitos e diferenciais]

**Benefícios:**
[1 parágrafo curto com benefícios, quando houver]

**Como se candidatar:**
[1 parágrafo curto com orientação prática de candidatura usando os contatos disponíveis]

Dados da vaga:
Título: ${stripText(vaga.titulo)}
Empresa: ${stripText(vaga.empresa)}
Área: ${stripText(vaga.area)}
Tipo de contrato: ${stripText(vaga.tipo_contrato)}
Salário: ${stripText(vaga.salario)}
Local: ${stripText(vaga.local_vaga)}
Contato: ${stripText(vaga.contato)}
Descrição original: ${stripText(vaga.descricao)}

Retorne apenas o texto final da nova descrição, em texto puro, seguindo o template.`;
};

async function summarizeWithAI(vaga: VagaRow, apiKey: string, model: string): Promise<string> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      max_tokens: 500,
      messages: [{ role: "user", content: buildPrompt(vaga) }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${txt.slice(0, 800)}`);
  }

  const data = await res.json();
  const content = formatSectionHeadingsBold(
    removePromptLeak(normalizeParagraphText(data?.choices?.[0]?.message?.content ?? "")),
  );
  if (!content) throw new Error("IA sem conteudo");
  return content;
}

async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
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
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = (await req.json()) as RequestBody;
    const cidade_id = body?.cidade_id;
    const limit = Math.min(Math.max(body?.limit ?? LIMIT_DEFAULT, 1), LIMIT_MAX);

    if (!cidade_id) {
      return new Response(JSON.stringify({ ok: false, error: "cidade_id obrigatorio" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!openaiKey) {
      return new Response(JSON.stringify({ ok: false, error: "OPENAI_API_KEY ausente nos secrets" }), {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }
    const model = Deno.env.get("AGENTE_EMPREGO_TEXTO_02_MODEL") ?? MODEL_DEFAULT;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("vagas_emprego_scraping")
      .select("id, cidade_id, titulo, empresa, descricao, area, tipo_contrato, salario, local_vaga, contato, status_fluxo, publicado_em_vagas")
      .eq("cidade_id", cidade_id)
      .eq("publicado_em_vagas", false)
      .eq("status_fluxo", "coletada")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = ((data ?? []) as VagaRow[]).filter((r) => stripText(r.descricao).length > 0);
    if (!rows.length) {
      return new Response(
        JSON.stringify({
          ok: true,
          agente: "agente_emprego_texto_02",
          cidade_id,
          total_entrada: 0,
          total_processado: 0,
          total_erros: 0,
          itens: [],
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const items: ProcessItem[] = [];
    const tasks = rows.map((vaga) => async () => {
      const resumo = await summarizeWithAI(vaga, openaiKey, model);
      const salarioDoResumo = extractSalarioFromText(resumo);
      const salarioAtual = sanitizeSalario(vaga.salario);
      const salarioNaDescricao = extractSalarioFromText(vaga.descricao);
      const salarioFinal = salarioDoResumo ?? salarioNaDescricao ?? salarioAtual;
      const { error: updErr } = await supabase
        .from("vagas_emprego_scraping")
        .update({
          descricao: resumo,
          salario: salarioFinal,
          processado_texto_02: true,
          texto_02_processado_at: new Date().toISOString(),
          status_fluxo: "resumida",
        })
        .eq("id", vaga.id);
      if (updErr) throw new Error(`Update ${vaga.id}: ${updErr.message}`);
      const item: ProcessItem = { id: vaga.id, ok: true };
      items.push(item);
      return item;
    });

    const settled = await runConcurrent(tasks, CONCURRENCY);

    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === "rejected") {
        items.push({ id: rows[i].id, ok: false, erro: String(r.reason) });
      }
    }

    const total_processado = items.filter((x) => x.ok).length;
    const total_erros = items.length - total_processado;

    return new Response(
      JSON.stringify({
        ok: true,
        agente: "agente_emprego_texto_02",
        cidade_id,
        model,
        total_entrada: rows.length,
        total_processado,
        total_erros,
        itens: items.slice(0, 50),
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      },
    );
  }
});
