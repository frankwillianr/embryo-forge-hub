import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
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
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Get the signature from headers
    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No stripe-signature header");
    }

    // Get raw body for signature verification
    const body = await req.text();
    logStep("Verifying webhook signature");

    // Verify the webhook signature
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err: any) {
      logStep("Webhook signature verification failed", { error: err.message });
      return new Response(JSON.stringify({ error: "Webhook signature verification failed" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    logStep("Event received", { type: event.type, id: event.id });

    // Handle checkout.session.completed event
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      logStep("Checkout session completed", { 
        sessionId: session.id, 
        paymentStatus: session.payment_status,
        metadata: session.metadata 
      });

      // Only process if payment is successful
      if (session.payment_status === "paid") {
        const bannerId = session.metadata?.banner_id;
        const cidadeId = session.metadata?.cidade_id;
        const userId = session.metadata?.user_id;
        const diasComprados = parseInt(session.metadata?.dias_comprados || "0");

        if (!bannerId) {
          logStep("No banner_id in metadata, skipping");
          return new Response(JSON.stringify({ received: true }), {
            status: 200,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          });
        }

        logStep("Processing banner payment", { bannerId, cidadeId, userId, diasComprados });

        // Update pagamento_banner status to "pago"
        const { error: paymentError } = await supabaseClient
          .from("pagamento_banner")
          .update({
            status: "pago",
            pago_em: new Date().toISOString(),
            stripe_payment_intent_id: session.payment_intent as string,
          })
          .eq("stripe_session_id", session.id);

        if (paymentError) {
          logStep("Error updating payment record", { error: paymentError });
          throw new Error(`Failed to update payment: ${paymentError.message}`);
        }
        logStep("Payment record updated to 'pago'");

        // Update banner status to "pendente" (aguardando análise admin)
        const { error: bannerError } = await supabaseClient
          .from("banner")
          .update({ status: "pendente" })
          .eq("id", bannerId);

        if (bannerError) {
          logStep("Error updating banner status", { error: bannerError });
          throw new Error(`Failed to update banner: ${bannerError.message}`);
        }
        logStep("Banner status updated to 'pendente' (awaiting admin review)");

        // Create rel_banner_dias records for the exhibition days
        if (diasComprados > 0) {
          const today = new Date();
          const diasRecords = [];
          
          for (let i = 0; i < diasComprados; i++) {
            const dataExibicao = new Date(today);
            dataExibicao.setDate(today.getDate() + i);
            diasRecords.push({
              banner_id: bannerId,
              data_exibicao: dataExibicao.toISOString().split("T")[0],
              utilizado: false,
            });
          }

          const { error: diasError } = await supabaseClient
            .from("rel_banner_dias")
            .insert(diasRecords);

          if (diasError) {
            logStep("Error creating exhibition days", { error: diasError });
            // Don't throw here, payment is already processed
          } else {
            logStep("Exhibition days created", { count: diasRecords.length });
          }
        }

        logStep("Banner payment processed successfully");
      }
    }

    // Handle payment_intent.payment_failed event
    if (event.type === "payment_intent.payment_failed") {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      logStep("Payment failed", { paymentIntentId: paymentIntent.id });
      
      // Update payment record if exists
      const { error } = await supabaseClient
        .from("pagamento_banner")
        .update({ status: "cancelado" })
        .eq("stripe_payment_intent_id", paymentIntent.id);

      if (error) {
        logStep("Error updating failed payment", { error });
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    logStep("ERROR", { message: error.message });
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
