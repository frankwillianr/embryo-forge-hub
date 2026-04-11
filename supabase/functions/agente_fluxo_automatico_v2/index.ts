const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  cidade_id: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function invokeEdge(
  baseUrl: string,
  apikey: string,
  bearer: string,
  fnName: string,
  body: unknown,
) {
  const res = await fetch(`${baseUrl}/functions/v1/${fnName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey,
      Authorization: bearer,
    },
    body: JSON.stringify(body),
  });

  const raw = await res.text();
  let parsed: any = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }

  if (!res.ok) {
    throw new Error(`${fnName} HTTP ${res.status}: ${typeof parsed === "string" ? parsed.slice(0, 300) : JSON.stringify(parsed).slice(0, 300)}`);
  }

  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<RequestBody>;
    const cidade_id = body?.cidade_id;
    if (!cidade_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "cidade_id obrigatorio" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";

    if (!supabaseUrl || !anonKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "SUPABASE_URL/SUPABASE_ANON_KEY ausentes" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const bearer = authHeader.startsWith("Bearer ") ? authHeader : `Bearer ${anonKey}`;

    const steps: Array<Record<string, unknown>> = [];

    const a1 = await invokeEdge(supabaseUrl, anonKey, bearer, "agente_buscador_01", {
      cidade_id,
      lookback_days: 7,
      max_articles: 120,
    });
    steps.push({ agente: "1", nome: "agente_buscador_01", ok: true, resumo: { inseridos: a1?.inseridos ?? 0 } });

    const a2 = await invokeEdge(supabaseUrl, anonKey, bearer, "agente_conferencia_02", {
      cidade_id,
      limit: 300,
    });
    steps.push({
      agente: "2",
      nome: "agente_conferencia_02",
      ok: true,
      resumo: {
        duplicadas: a2?.total_duplicadas ?? 0,
        deletadas: a2?.total_deletadas ?? 0,
      },
    });

    const a3 = await invokeEdge(supabaseUrl, anonKey, bearer, "agente_texto_03", {
      cidade_id,
      limit: 150,
    });
    steps.push({ agente: "3", nome: "agente_texto_03", ok: true, resumo: { processado: a3?.total_processado ?? 0 } });

    let a4Processadas = 0;
    let a4Erros = 0;
    let a4Rodadas = 0;
    let workerLimitHits = 0;
    const MAX_RODADAS = 220;
    for (let i = 0; i < MAX_RODADAS; i++) {
      a4Rodadas++;
      try {
        const r = await invokeEdge(supabaseUrl, anonKey, bearer, "agente_imagem_04", {
          cidade_id,
          limit: 1,
        });

        const proc = Number(r?.total_processado ?? 0);
        const err = Number(r?.total_erros ?? 0);
        const restantes = Number(r?.restantes_globais ?? 0);

        a4Processadas += proc;
        a4Erros += err;
        workerLimitHits = 0;

        if (restantes <= 0) break;
        if (proc <= 0 && err <= 0) break;

        await sleep(1200);
      } catch (e) {
        const msg = String(e);
        if (msg.includes("HTTP 546") || msg.includes("WORKER_LIMIT")) {
          workerLimitHits++;
          if (workerLimitHits >= 8) throw e;
          await sleep(3000);
          continue;
        }
        throw e;
      }
    }
    steps.push({
      agente: "4",
      nome: "agente_imagem_04",
      ok: true,
      resumo: { processadas: a4Processadas, erros: a4Erros, rodadas: a4Rodadas },
    });

    const a5 = await invokeEdge(supabaseUrl, anonKey, bearer, "agente_publicador_05", {
      cidade_id,
      limit: 150,
    });
    steps.push({
      agente: "5",
      nome: "agente_publicador_05",
      ok: true,
      resumo: {
        publicado: a5?.total_publicado ?? 0,
        ja_existia: a5?.total_ja_existia ?? 0,
        erros: a5?.total_erros ?? 0,
      },
    });

    return new Response(
      JSON.stringify({ ok: true, agente: "agente_fluxo_automatico_v2", cidade_id, steps }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
