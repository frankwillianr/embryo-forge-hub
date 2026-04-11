const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  cidade_id: string;
  max_vagas?: number;
  lookback_dias?: number;
}

function toInt(v: unknown, fallback: number): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.floor(n));
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
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = raw;
  }

  if (!res.ok) {
    throw new Error(
      `${fnName} HTTP ${res.status}: ${
        typeof parsed === "string" ? parsed.slice(0, 300) : JSON.stringify(parsed).slice(0, 300)
      }`,
    );
  }

  return parsed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<RequestBody>;
    const cidade_id = String(body?.cidade_id || "").trim();
    const max_vagas = toInt(body?.max_vagas, 60);
    const lookback_dias = toInt(body?.lookback_dias, 14);

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

    const a1 = await invokeEdge(supabaseUrl, anonKey, bearer, "agente_emprego_buscador_01", {
      cidade_id,
      max_vagas,
      lookback_dias,
    });
    steps.push({
      agente: "1",
      nome: "agente_emprego_buscador_01",
      ok: true,
      resumo: {
        vagas_encontradas: (a1 as Record<string, unknown>)?.vagas_encontradas ?? 0,
        vagas_inseridas: (a1 as Record<string, unknown>)?.vagas_inseridas ?? 0,
      },
    });

    const a2 = await invokeEdge(supabaseUrl, anonKey, bearer, "agente_emprego_texto_02", {
      cidade_id,
      limit: max_vagas,
    });
    steps.push({
      agente: "2",
      nome: "agente_emprego_texto_02",
      ok: true,
      resumo: {
        total_processado: (a2 as Record<string, unknown>)?.total_processado ?? 0,
        total_erros: (a2 as Record<string, unknown>)?.total_erros ?? 0,
      },
    });

    const a3 = await invokeEdge(supabaseUrl, anonKey, bearer, "agente_emprego_preco_03", {
      cidade_id,
      limit: max_vagas,
    });
    steps.push({
      agente: "3",
      nome: "agente_emprego_preco_03",
      ok: true,
      resumo: {
        total_aceitos: (a3 as Record<string, unknown>)?.total_aceitos ?? 0,
        total_rejeitados: (a3 as Record<string, unknown>)?.total_rejeitados ?? 0,
      },
    });

    const a4 = await invokeEdge(supabaseUrl, anonKey, bearer, "agente_emprego_publicador_04", {
      cidade_id,
      limit: max_vagas * 2,
    });
    steps.push({
      agente: "4",
      nome: "agente_emprego_publicador_04",
      ok: true,
      resumo: {
        inseridas: (a4 as Record<string, unknown>)?.inseridas ?? 0,
        ignoradas_invalidas: (a4 as Record<string, unknown>)?.ignoradas_invalidas ?? 0,
      },
    });

    return new Response(
      JSON.stringify({
        ok: true,
        agente: "agente_fluxo_automatico_emprego_v1",
        cidade_id,
        steps,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});

