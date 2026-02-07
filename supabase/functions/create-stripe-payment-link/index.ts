import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-client-lib",
};

interface PaymentRequest {
  amount: number; // valor em centavos (ex: 10000 = R$ 100,00)
  description?: string;
  customerEmail?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const { amount, description, customerEmail }: PaymentRequest = await req.json();

    if (!amount || amount <= 0) {
      throw new Error("Amount must be greater than 0");
    }

    console.log(`Creating payment link for amount: ${amount} BRL`);

    // Criar um Payment Link no Stripe
    const paymentLinkPayload = {
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: description || "Publicidade - Open City",
              description: "Link de pagamento gerado pela Open City",
            },
            unit_amount: Math.round(amount), // valor em centavos
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      after_completion: {
        type: "redirect",
        redirect: {
          url: "https://opencity.app/pagamento-confirmado", // Mude para sua URL de sucesso
        },
      },
    };

    // Adicionar email do cliente se fornecido
    if (customerEmail) {
      paymentLinkPayload.customer_email = customerEmail;
    }

    const response = await fetch("https://api.stripe.com/v1/payment_links", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${stripeSecretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(flattenObject(paymentLinkPayload)).toString(),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Stripe API error:", result);
      throw new Error(result.error?.message || "Failed to create payment link");
    }

    console.log("Payment link created successfully:", result.url);

    return new Response(
      JSON.stringify({
        success: true,
        paymentUrl: result.url,
        paymentLinkId: result.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error creating payment link:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

// Função auxiliar para converter objeto para formato esperado pelo Stripe
function flattenObject(obj: any, prefix = ""): any {
  const result: any = {};

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const value = obj[key];
      const newKey = prefix ? `${prefix}[${key}]` : key;

      if (value !== null && typeof value === "object" && !Array.isArray(value)) {
        Object.assign(result, flattenObject(value, newKey));
      } else if (Array.isArray(value)) {
        value.forEach((item, index) => {
          if (typeof item === "object" && item !== null) {
            Object.assign(result, flattenObject(item, `${newKey}[${index}]`));
          } else {
            result[`${newKey}[${index}]`] = item;
          }
        });
      } else {
        result[newKey] = value;
      }
    }
  }

  return result;
}

serve(handler);
```

**Agora:**

1. Abra seu repositório no GitHub
2. Clique em **Add file** → **Create new file**
3. Nome do arquivo:
```
supabase/functions/create-stripe-payment-link/index.ts
