import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  cidade_id: string;
}

const MAX_TOTAL_MS = 125_000;
const IMAGE_PHASE_DEADLINE_MS = 92_000;
const RESPONSE_SAFETY_BUFFER_MS = 12_000;
const PUBLICADOR_LIMIT = 30;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function createAdminClient() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceKey) return null;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function insertAutoLog(
  supabase: ReturnType<typeof createAdminClient>,
  cidadeId: string,
  origem: string,
) {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("cidade_scraping_auto_log")
    .insert({ cidade_id: cidadeId, origem, status: "running" })
    .select("id")
    .maybeSingle();

  if (error) console.error("auto_log_insert_error", error.message);
  return data as { id: string } | null;
}

async function updateAutoLog(
  supabase: ReturnType<typeof createAdminClient>,
  id: string | null,
  patch: Record<string, unknown>,
) {
  if (!supabase || !id) return;
  const { error } = await supabase.from("cidade_scraping_auto_log").update(patch).eq("id", id);
  if (error) console.error("auto_log_update_error", error.message);
}

async function invokeEdge(
  baseUrl: string,
  apikey: string,
  bearer: string,
  fnName: string,
  body: unknown,
  timeoutMs: number,
) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);

  try {
    const res = await fetch(`${baseUrl}/functions/v1/${fnName}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey,
        Authorization: bearer,
      },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });

    const raw = await res.text();
    let parsed: any = null;
    try {
      parsed = raw ? JSON.parse(raw) : null;
    } catch {
      parsed = raw;
    }

    if (!res.ok) {
      const detail = typeof parsed === "string" ? parsed.slice(0, 300) : JSON.stringify(parsed).slice(0, 300);
      throw new Error(`${fnName} HTTP ${res.status}: ${detail}`);
    }

    return parsed;
  } catch (e) {
    if (e instanceof DOMException && e.name === "AbortError") {
      throw new Error(`${fnName} timeout apos ${timeoutMs}ms`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const startedAt = Date.now();
  const admin = createAdminClient();
  const steps: Array<Record<string, unknown>> = [];
  let logId: string | null = null;
  let cidadeId: string | undefined;

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<RequestBody>;
    cidadeId = body?.cidade_id;
    if (!cidadeId) {
      return new Response(
        JSON.stringify({ ok: false, error: "cidade_id obrigatorio" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const authHeader = req.headers.get("Authorization") ?? "";
    const origem = req.headers.get("x-cron-origin") ?? "edge";

    if (!supabaseUrl || !anonKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "SUPABASE_URL/SUPABASE_ANON_KEY ausentes" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const log = await insertAutoLog(admin, cidadeId, origem);
    logId = log?.id ?? null;

    const bearer = authHeader.startsWith("Bearer ") ? authHeader : `Bearer ${anonKey}`;
    const remainingBudget = () => Math.max(MAX_TOTAL_MS - (Date.now() - startedAt) - RESPONSE_SAFETY_BUFFER_MS, 0);
    const invokeWithBudget = (fnName: string, payload: unknown, maxTimeoutMs: number) => {
      const timeoutMs = Math.min(maxTimeoutMs, remainingBudget());
      if (timeoutMs < 5_000) throw new Error(`tempo_insuficiente_para_${fnName}`);
      return invokeEdge(supabaseUrl, anonKey, bearer, fnName, payload, timeoutMs);
    };
    const pushStep = async (step: Record<string, unknown>) => {
      steps.push(step);
      await updateAutoLog(admin, logId, { steps });
    };
    const pushFailedStep = async (agente: string, nome: string, error: unknown) => {
      await pushStep({
        agente,
        nome,
        ok: false,
        resumo: { error: String(error) },
      });
    };

    try {
      const publicadorInicial = await invokeWithBudget("agente_publicador_05", {
        cidade_id: cidadeId,
        limit: PUBLICADOR_LIMIT,
        max_age_days: 10,
      }, 18_000);
      await pushStep({
        agente: "5-pre",
        nome: "agente_publicador_05",
        ok: true,
        resumo: {
          publicado: publicadorInicial?.total_publicado ?? 0,
          ja_existia: publicadorInicial?.total_ja_existia ?? 0,
          erros: publicadorInicial?.total_erros ?? 0,
        },
      });
    } catch (e) {
      await pushFailedStep("5-pre", "agente_publicador_05", e);
    }

    const a1 = await invokeWithBudget("agente_buscador_01", {
      cidade_id: cidadeId,
      lookback_days: 7,
      max_articles: 120,
    }, 50_000);
    await pushStep({ agente: "1", nome: "agente_buscador_01", ok: true, resumo: { inseridos: a1?.inseridos ?? 0 } });

    try {
      const a2 = await invokeWithBudget("agente_conferencia_02", {
        cidade_id: cidadeId,
        limit: 120,
      }, 35_000);
      await pushStep({
        agente: "2",
        nome: "agente_conferencia_02",
        ok: true,
        resumo: {
          duplicadas: a2?.total_duplicadas ?? 0,
          deletadas: a2?.total_deletadas ?? 0,
        },
      });
    } catch (e) {
      await pushFailedStep("2", "agente_conferencia_02", e);
    }

    try {
      const a3 = await invokeWithBudget("agente_texto_03", {
        cidade_id: cidadeId,
        limit: 60,
      }, 40_000);
      await pushStep({ agente: "3", nome: "agente_texto_03", ok: true, resumo: { processado: a3?.total_processado ?? 0 } });
    } catch (e) {
      await pushFailedStep("3", "agente_texto_03", e);
    }

    let a4Processadas = 0;
    let a4Erros = 0;
    let a4Rodadas = 0;
    let workerLimitHits = 0;
    const MAX_RODADAS = 24;
    let a4Erro: string | null = null;

    for (let i = 0; i < MAX_RODADAS; i++) {
      if (Date.now() - startedAt >= IMAGE_PHASE_DEADLINE_MS) break;
      a4Rodadas++;
      try {
        const r = await invokeWithBudget("agente_imagem_04", {
          cidade_id: cidadeId,
          limit: 1,
        }, 18_000);

        const proc = Number(r?.total_processado ?? 0);
        const err = Number(r?.total_erros ?? 0);
        const restantes = Number(r?.restantes_globais ?? 0);

        a4Processadas += proc;
        a4Erros += err;
        workerLimitHits = 0;

        if (restantes <= 0) break;
        if (proc <= 0 && err <= 0) break;
        if (Date.now() - startedAt >= IMAGE_PHASE_DEADLINE_MS) break;

        await sleep(1200);
      } catch (e) {
        const msg = String(e);
        if (msg.includes("HTTP 546") || msg.includes("WORKER_LIMIT")) {
          workerLimitHits++;
          if (workerLimitHits >= 4) {
            a4Erro = msg;
            break;
          }
          await sleep(3000);
          continue;
        }
        a4Erro = msg;
        break;
      }
    }
    await pushStep({
      agente: "4",
      nome: "agente_imagem_04",
      ok: !a4Erro,
      resumo: { processadas: a4Processadas, erros: a4Erros, rodadas: a4Rodadas, erro: a4Erro },
    });

    if (Date.now() - startedAt >= MAX_TOTAL_MS - RESPONSE_SAFETY_BUFFER_MS) {
      await pushStep({
        agente: "5",
        nome: "agente_publicador_05",
        ok: false,
        resumo: { skipped: true, reason: "tempo_esgotado_antes_do_publicador_final" },
      });

      await updateAutoLog(admin, logId, {
        status: "partial",
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt,
        steps,
      });

      return new Response(
        JSON.stringify({ ok: true, agente: "agente_fluxo_automatico_v2", cidade_id: cidadeId, steps }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    try {
      const a5 = await invokeWithBudget("agente_publicador_05", {
        cidade_id: cidadeId,
        limit: PUBLICADOR_LIMIT,
        max_age_days: 10,
      }, 22_000);
      await pushStep({
        agente: "5",
        nome: "agente_publicador_05",
        ok: true,
        resumo: {
          publicado: a5?.total_publicado ?? 0,
          ja_existia: a5?.total_ja_existia ?? 0,
          erros: a5?.total_erros ?? 0,
        },
      });
    } catch (e) {
      await pushFailedStep("5", "agente_publicador_05", e);
    }

    const finalStatus = steps.some((step) => step.ok === false) ? "partial" : "success";
    await updateAutoLog(admin, logId, {
      status: finalStatus,
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      steps,
    });

    return new Response(
      JSON.stringify({ ok: true, status: finalStatus, agente: "agente_fluxo_automatico_v2", cidade_id: cidadeId, steps }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    await updateAutoLog(admin, logId, {
      status: "error",
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedAt,
      steps,
      error: String(err),
    });

    return new Response(
      JSON.stringify({ ok: false, error: String(err), cidade_id: cidadeId ?? null, steps }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
