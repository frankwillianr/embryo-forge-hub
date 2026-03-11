import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, asaas-access-token",
};

const paidEvents = new Set(["PAYMENT_RECEIVED", "PAYMENT_CONFIRMED", "PAYMENT_UPDATED"]);

const logStep = (step: string, details?: unknown) => {
  const detail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ASAAS-WEBHOOK] ${step}${detail}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const expectedToken = Deno.env.get("ASAAS_WEBHOOK_TOKEN") || "";

    if (!supabaseUrl || !serviceKey) throw new Error("SUPABASE env não configurada");

    if (expectedToken) {
      const incoming = req.headers.get("asaas-access-token") || req.headers.get("authorization")?.replace("Bearer ", "");
      if (!incoming || incoming !== expectedToken) {
        return new Response(JSON.stringify({ ok: false, error: "Token inválido" }), {
          status: 401,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        });
      }
    }

    const payload = await req.json();
    const event = String(payload?.event || "");
    const payment = payload?.payment || {};
    const paymentId = String(payment?.id || "");
    const paymentStatus = String(payment?.status || "");
    const externalReference = String(payment?.externalReference || "");
    const paymentLinkId = String(payment?.paymentLink || payment?.paymentLinkId || "");

    logStep("Evento recebido", { event, paymentId, paymentStatus, externalReference, paymentLinkId });

    if (!event || !paymentId) {
      return new Response(JSON.stringify({ ok: true, ignored: true, reason: "payload incompleto" }), {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    let empresaQuery = supabase
      .from("rel_cidade_servico_empresa")
      .select("id, status, data_inicio, data_fim")
      .eq("id", externalReference)
      .maybeSingle();

    let { data: empresa, error: empresaError } = await empresaQuery;

    if ((!empresa || empresaError) && paymentLinkId) {
      const fallback = await supabase
        .from("rel_cidade_servico_empresa")
        .select("id, status, data_inicio, data_fim")
        .eq("asaas_payment_link_id", paymentLinkId)
        .maybeSingle();
      empresa = fallback.data;
      empresaError = fallback.error;
    }

    if (empresaError || !empresa) {
      throw new Error(`Empresa não localizada para o webhook (${empresaError?.message || "sem dados"})`);
    }

    const baseUpdate: Record<string, unknown> = {
      asaas_payment_id: paymentId,
      asaas_payment_status: paymentStatus || null,
      asaas_last_event: event,
    };

    const isPaidEvent = paidEvents.has(event) && ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(paymentStatus);
    if (isPaidEvent) {
      const hoje = new Date().toISOString().split("T")[0];
      const fimPadrao = new Date();
      fimPadrao.setFullYear(fimPadrao.getFullYear() + 1);
      const fimPadraoStr = fimPadrao.toISOString().split("T")[0];

      baseUpdate.status = "ativo";
      baseUpdate.asaas_paid_at = new Date().toISOString();
      baseUpdate.data_inicio = empresa.data_inicio || hoje;
      baseUpdate.data_fim = empresa.data_fim || fimPadraoStr;
    }

    const { error: updateError } = await supabase
      .from("rel_cidade_servico_empresa")
      .update(baseUpdate)
      .eq("id", empresa.id);

    if (updateError) throw new Error(`Falha ao atualizar empresa: ${updateError.message}`);

    return new Response(JSON.stringify({ ok: true, empresa_id: empresa.id, paid: isPaidEvent }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
