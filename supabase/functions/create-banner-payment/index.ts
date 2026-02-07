import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-client-lib",
};

interface BannerPaymentRequest {
  bannerId: string;
  cidadeId: string;
  cidadeNome: string;
  bannerTitulo: string;
  valorTotal: number;
  diasComprados: number;
  valorDia: number;
  userEmail: string;
  userName?: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-BANNER-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Function started");

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse request body
    const body: BannerPaymentRequest = await req.json();
    logStep("Request body", body);

    const {
      bannerId,
      cidadeId,
      cidadeNome,
      bannerTitulo,
      valorTotal,
      diasComprados,
      valorDia,
      userEmail,
      userName,
    } = body;

    // Validate required fields
    if (!bannerId || !cidadeId || !valorTotal || !diasComprados) {
      throw new Error("Missing required fields");
    }

    // Initialize Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    logStep("Stripe initialized");

    // Check for existing Stripe customer
    const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
    let customerId: string | undefined;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Existing customer found", { customerId });
    }

    // Calculate expiration (1 hour from now)
    const expiresAt = Math.floor(Date.now() / 1000) + 3600; // 1 hour in seconds
    const expiresAtDate = new Date(expiresAt * 1000);

    // Get origin for redirect URLs
    const origin = req.headers.get("origin") || "https://embryo-forge-hub.lovable.app";

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : userEmail,
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `Banner: ${bannerTitulo}`,
              description: `${diasComprados} dias de exibição em ${cidadeNome}`,
            },
            unit_amount: Math.round(valorTotal * 100), // Convert to centavos
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/cidade/${cidadeNome.toLowerCase().replace(/\s+/g, '-')}/banner/sucesso?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cidade/${cidadeNome.toLowerCase().replace(/\s+/g, '-')}/banner/cancelado`,
      expires_at: expiresAt,
      metadata: {
        banner_id: bannerId,
        cidade_id: cidadeId,
        user_id: user.id,
        dias_comprados: diasComprados.toString(),
      },
    });

    logStep("Stripe session created", { sessionId: session.id, url: session.url });

    // Create payment record in database
    const { data: paymentData, error: paymentError } = await supabaseClient
      .from("pagamento_banner")
      .insert({
        banner_id: bannerId,
        user_id: user.id,
        cidade_id: cidadeId,
        valor: valorTotal,
        dias_comprados: diasComprados,
        valor_dia: valorDia,
        stripe_session_id: session.id,
        status: "pendente",
        expira_em: expiresAtDate.toISOString(),
      })
      .select()
      .single();

    if (paymentError) {
      logStep("Error creating payment record", { error: paymentError });
      throw new Error(`Failed to create payment record: ${paymentError.message}`);
    }

    logStep("Payment record created", { paymentId: paymentData.id });

    // Update banner status to "aguardando_pagamento"
    const { error: bannerUpdateError } = await supabaseClient
      .from("banner")
      .update({ status: "aguardando_pagamento" })
      .eq("id", bannerId);

    if (bannerUpdateError) {
      logStep("Error updating banner status", { error: bannerUpdateError });
    } else {
      logStep("Banner status updated to aguardando_pagamento");
    }

    return new Response(
      JSON.stringify({
        success: true,
        sessionId: session.id,
        sessionUrl: session.url,
        paymentId: paymentData.id,
        expiresAt: expiresAtDate.toISOString(),
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});
