import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: unknown) => {
  const detail = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-ASAAS-EMPRESA-PAYMENT] ${step}${detail}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    const asaasBaseUrl = Deno.env.get("ASAAS_API_BASE_URL") ?? "https://api.asaas.com/v3";

    if (!supabaseUrl || !serviceKey) throw new Error("SUPABASE env não configurada");
    if (!asaasApiKey) throw new Error("ASAAS_API_KEY não configurada");

    const body = await req.json();
    const empresaId = String(body?.empresa_id || "");
    const valor = Number(body?.valor || 0);

    if (!empresaId) throw new Error("empresa_id é obrigatório");
    if (!Number.isFinite(valor) || valor <= 0) throw new Error("valor inválido");

    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

    const { data: empresa, error: empresaError } = await supabase
      .from("rel_cidade_servico_empresa")
      .select("id, nome, user_id, cidade_id, data_inicio, data_fim")
      .eq("id", empresaId)
      .maybeSingle();

    if (empresaError || !empresa) {
      throw new Error(`Empresa não encontrada: ${empresaError?.message || "sem dados"}`);
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("id, nome, email, cpf")
      .eq("id", empresa.user_id)
      .maybeSingle();

    if (profileError || !profile?.email) {
      throw new Error(`Perfil do usuário sem e-mail: ${profileError?.message || "sem email"}`);
    }

    const customerPayload: Record<string, unknown> = {
      name: profile.nome || empresa.nome || "Cliente Open City",
      email: profile.email,
      cpfCnpj: (profile.cpf || "").replace(/\D/g, "") || undefined,
      externalReference: empresa.id,
      notificationDisabled: false,
    };

    logStep("Criando/atualizando customer", { empresaId, email: profile.email });
    const customerResp = await fetch(`${asaasBaseUrl}/customers`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify(customerPayload),
    });

    if (!customerResp.ok) {
      const text = await customerResp.text();
      throw new Error(`Erro Asaas customer HTTP ${customerResp.status}: ${text}`);
    }

    const customerJson = await customerResp.json();
    const customerId = customerJson?.id;
    if (!customerId) throw new Error("Asaas não retornou customer.id");

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 3);
    const dueDateStr = dueDate.toISOString().split("T")[0];

    const paymentPayload = {
      customer: customerId,
      billingType: "UNDEFINED",
      value: Number(valor.toFixed(2)),
      dueDate: dueDateStr,
      description: `Cadastro de empresa: ${empresa.nome}`,
      externalReference: empresa.id,
    };

    logStep("Criando cobrança Asaas", { empresaId, value: valor });
    const paymentResp = await fetch(`${asaasBaseUrl}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        access_token: asaasApiKey,
      },
      body: JSON.stringify(paymentPayload),
    });

    if (!paymentResp.ok) {
      const text = await paymentResp.text();
      throw new Error(`Erro Asaas payment HTTP ${paymentResp.status}: ${text}`);
    }

    const paymentJson = await paymentResp.json();
    const paymentId = paymentJson?.id;
    const invoiceUrl = paymentJson?.invoiceUrl || paymentJson?.bankSlipUrl || paymentJson?.invoiceNumber;

    if (!paymentId || !invoiceUrl) {
      throw new Error("Asaas não retornou dados de pagamento suficientes");
    }

    const { error: updateError } = await supabase
      .from("rel_cidade_servico_empresa")
      .update({
        status: "aguardando_pagamento",
        asaas_payment_link_id: paymentId,
        asaas_payment_id: paymentId,
        asaas_payment_url: invoiceUrl,
        asaas_payment_value: Number(valor.toFixed(2)),
        asaas_payment_status: paymentJson?.status || "PENDING",
        asaas_external_reference: empresa.id,
      })
      .eq("id", empresa.id);

    if (updateError) {
      throw new Error(`Falha ao salvar pagamento da empresa: ${updateError.message}`);
    }

    return new Response(
      JSON.stringify({
        ok: true,
        empresa_id: empresa.id,
        payment_id: paymentId,
        payment_url: invoiceUrl,
        status: paymentJson?.status || "PENDING",
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    logStep("ERROR", { message });
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
