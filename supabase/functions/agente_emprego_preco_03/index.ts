import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIMIT_DEFAULT = 80;
const LIMIT_MAX = 300;
const CONCURRENCY = 4;
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
  salario: string | null;
  descricao: string | null;
  status_fluxo: string | null;
  publicado_em_vagas: boolean | null;
}

interface PriceDecision {
  aceito: boolean;
  salario: string | null;
  motivo: string;
}

interface ProcessItem {
  id: string;
  ok: boolean;
  aceito?: boolean;
  salario_final?: string | null;
  erro?: string;
}

const clean = (v: string | null | undefined) => (v ?? "").replace(/\s+/g, " ").trim();

const PRICE_RE = /^R\$\s\d{1,3}(?:\.\d{3})*,\d{2}$/;

const normalizeMoney = (raw: string | null | undefined): string | null => {
  const txt = clean(raw);
  if (!txt) return null;

  const withCurrency = txt.match(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (withCurrency) return `R$ ${withCurrency[1]}`;

  const withoutCurrency = txt.match(/\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/);
  if (withoutCurrency) return `R$ ${withoutCurrency[1]}`;

  return null;
};

const extractMoneyFromDescription = (raw: string | null | undefined): string | null => {
  const txt = clean(raw);
  if (!txt) return null;

  const exact = txt.match(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/i);
  if (exact) return normalizeMoney(exact[0]);

  const labeled = txt.match(/sal[aá]rio[^:\n]{0,20}[:\-\s]+([^\n]{2,120})/i);
  if (labeled) return normalizeMoney(labeled[1]);

  const plain = txt.match(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b/);
  if (plain) return normalizeMoney(plain[0]);

  return null;
};

const extractJsonObject = (raw: string): Record<string, unknown> | null => {
  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;
  try {
    return JSON.parse(raw.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
};

const buildPrompt = (vaga: VagaRow): string => `
Voce e um validador de salario para vagas de emprego.
Sua tarefa: decidir se o salario pode ser salvo no banco.

SAIDA OBRIGATORIA:
Retorne APENAS JSON valido, sem markdown, sem texto extra:
{"aceito":true|false,"salario":"R$ 0,00"|null,"motivo":"texto curto"}

REGRAS DE ACEITE:
- Aceite somente quando houver valor monetario explicito em reais.
- Formato final deve ser exatamente: R$ 1.234,56
- Se vier sem R$ mas com valor claro (ex: 1621,00), normalize para R$ 1.621,00.
- Se houver faixa (ex: R$ 1.621,00 a R$ 2.277,00), use somente o primeiro valor.

REGRAS DE REJEICAO (aceito = false e salario = null):
- Termos vagos: "a combinar", "compativel com o mercado", "salario minimo", "garantia de salario minimo".
- Texto que mistura salario com beneficios/comissao/ticket/bonus sem um valor unico limpo.
- Qualquer texto sem valor numerico monetario claro.

Dados da vaga:
Titulo: ${clean(vaga.titulo)}
Empresa: ${clean(vaga.empresa)}
Salario atual: ${clean(vaga.salario)}
Descricao: ${clean(vaga.descricao).slice(0, 2500)}
`;

async function validatePriceWithAI(vaga: VagaRow, apiKey: string, model: string): Promise<PriceDecision> {
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
      messages: [{ role: "user", content: buildPrompt(vaga) }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${txt.slice(0, 800)}`);
  }

  const data = await res.json();
  const content = clean(data?.choices?.[0]?.message?.content ?? "");
  const parsed = extractJsonObject(content);

  if (!parsed) {
    throw new Error(`IA sem JSON valido: ${content.slice(0, 300)}`);
  }

  const aceito = parsed.aceito === true;
  const salarioRaw = typeof parsed.salario === "string" ? parsed.salario : null;
  const salarioNorm = normalizeMoney(salarioRaw);
  const salarioFinal = aceito && salarioNorm && PRICE_RE.test(salarioNorm) ? salarioNorm : null;
  const motivo = typeof parsed.motivo === "string" ? clean(parsed.motivo) : "sem motivo";

  return {
    aceito: aceito && !!salarioFinal,
    salario: aceito ? salarioFinal : null,
    motivo,
  };
}

async function runConcurrent<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<PromiseSettledResult<T>[]> {
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
    const cidade_id = clean(body?.cidade_id);
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

    const model = Deno.env.get("AGENTE_EMPREGO_PRECO_03_MODEL") ?? MODEL_DEFAULT;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("vagas_emprego_scraping")
      .select("id, cidade_id, titulo, empresa, salario, descricao, status_fluxo, publicado_em_vagas")
      .eq("cidade_id", cidade_id)
      .eq("publicado_em_vagas", false)
      .eq("status_fluxo", "resumida")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const rows = (data ?? []) as VagaRow[];
    if (!rows.length) {
      return new Response(
        JSON.stringify({
          ok: true,
          agente: "agente_emprego_preco_03",
          cidade_id,
          model,
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
      let decision: PriceDecision;
      try {
        decision = await validatePriceWithAI(vaga, openaiKey, model);
      } catch {
        const fallback = normalizeMoney(vaga.salario) ?? extractMoneyFromDescription(vaga.descricao);
        decision = {
          aceito: !!fallback,
          salario: fallback,
          motivo: "fallback_regex",
        };
      }

      const salarioFinal = decision.aceito && decision.salario ? decision.salario : null;
      const { error: updErr } = await supabase
        .from("vagas_emprego_scraping")
        .update({
          salario: salarioFinal,
          status_fluxo: "preco_validado",
        })
        .eq("id", vaga.id);

      if (updErr) throw new Error(`Update ${vaga.id}: ${updErr.message}`);

      const item: ProcessItem = {
        id: vaga.id,
        ok: true,
        aceito: !!salarioFinal,
        salario_final: salarioFinal,
      };
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
    const total_aceitos = items.filter((x) => x.ok && x.aceito).length;
    const total_rejeitados = items.filter((x) => x.ok && x.aceito === false).length;

    return new Response(
      JSON.stringify({
        ok: true,
        agente: "agente_emprego_preco_03",
        cidade_id,
        model,
        total_entrada: rows.length,
        total_processado,
        total_erros,
        total_aceitos,
        total_rejeitados,
        itens: items.slice(0, 80),
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