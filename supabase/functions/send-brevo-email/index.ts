import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EmailRequest {
  to: string;
  subject?: string;
  htmlContent?: string;
  textContent?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY not configured");
    }

    const { to, subject, htmlContent, textContent }: EmailRequest = await req.json();

    if (!to) {
      throw new Error("Email recipient (to) is required");
    }

    console.log(`Sending email to: ${to}`);

    const emailPayload = {
      sender: {
        name: "Guia Virtual",
        email: "noreply@guiavirtual.app", // Configure seu domínio verificado no Brevo
      },
      to: [{ email: to }],
      subject: subject || "Teste de Email - Guia Virtual",
      htmlContent: htmlContent || `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h1 style="color: #331D4A;">Olá! 👋</h1>
            <p>Este é um email de teste enviado pelo Guia Virtual.</p>
            <p>Se você recebeu este email, a integração com o Brevo está funcionando corretamente!</p>
            <hr style="border: 1px solid #eee; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">Guia Virtual - Sua cidade na palma da mão</p>
          </body>
        </html>
      `,
      textContent: textContent || "Este é um email de teste enviado pelo Guia Virtual.",
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Brevo API error:", result);
      throw new Error(result.message || "Failed to send email");
    }

    console.log("Email sent successfully:", result);

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
