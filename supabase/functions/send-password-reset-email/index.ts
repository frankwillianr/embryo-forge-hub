import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-client-lib",
};

interface ResetPasswordRequest {
  email: string;
  redirectTo: string;
  cidadeNome?: string | null;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const generateEmailTemplate = (confirmationUrl: string, cidadeNome: string) => {
  const safeCidade = escapeHtml(cidadeNome || "Governador Valadares");
  const safeUrl = escapeHtml(confirmationUrl);

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Recupere sua senha</title>
  </head>
  <body style="margin:0;background:#f6f4f8;font-family:Arial,Helvetica,sans-serif;color:#241333;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f6f4f8;padding:28px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #ece7f2;box-shadow:0 18px 50px rgba(51,29,74,.12);">
            <tr>
              <td style="background:#331d4a;padding:30px 28px 26px;">
                <div style="font-size:13px;line-height:20px;color:#f7cfe1;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">
                  ${safeCidade}
                </div>
                <h1 style="margin:8px 0 0;font-size:28px;line-height:34px;color:#ffffff;font-weight:800;">
                  Vamos recuperar seu acesso
                </h1>
                <p style="margin:10px 0 0;font-size:15px;line-height:23px;color:#e9dff0;">
                  Crie uma nova senha em poucos segundos.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:30px 28px 10px;">
                <p style="margin:0 0 16px;font-size:16px;line-height:25px;color:#3b2a4d;">
                  Recebemos uma solicitação para redefinir a senha da sua conta.
                </p>
                <p style="margin:0 0 24px;font-size:16px;line-height:25px;color:#3b2a4d;">
                  Toque no botão abaixo para abrir uma página segura e escolher uma nova senha.
                </p>
                <a href="${safeUrl}" style="display:block;background:#e80560;color:#ffffff;text-decoration:none;text-align:center;font-size:16px;font-weight:800;padding:15px 18px;border-radius:12px;">
                  Criar nova senha
                </a>
                <div style="margin:24px 0 0;padding:16px;border-radius:12px;background:#fff8e7;border:1px solid #f3dfad;">
                  <p style="margin:0;font-size:13px;line-height:20px;color:#7a5b13;">
                    Por segurança, este link expira. Se você não pediu essa alteração, ignore este email.
                  </p>
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 28px 28px;">
                <div style="border-top:1px solid #eee8f4;padding-top:18px;">
                  <p style="margin:0;font-size:12px;line-height:18px;color:#8b7f94;">
                    Caso o botão não funcione, copie e cole este link no navegador:
                  </p>
                  <p style="margin:8px 0 0;font-size:12px;line-height:18px;color:#5b476b;word-break:break-all;">
                    ${safeUrl}
                  </p>
                </div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");

    if (!supabaseUrl || !serviceRoleKey || !brevoApiKey) {
      throw new Error("Missing required environment variables");
    }

    const { email, redirectTo, cidadeNome }: ResetPasswordRequest = await req.json();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const normalizedRedirectTo = String(redirectTo || "").trim();

    if (!isValidEmail(normalizedEmail)) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (!normalizedRedirectTo.startsWith("http://") && !normalizedRedirectTo.startsWith("https://")) {
      return new Response(JSON.stringify({ error: "Redirect inválido" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (profileError) {
      console.error("Failed to check profile email:", profileError.message);
      throw new Error("Failed to check registered email");
    }

    if (!profile) {
      return new Response(JSON.stringify({ error: "EMAIL_NOT_FOUND" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: normalizedEmail,
      options: {
        redirectTo: normalizedRedirectTo,
      },
    });

    if (error) {
      console.error("Failed to generate recovery link:", error.message);
      throw new Error("Failed to generate recovery link");
    }

    if (!data.user) {
      return new Response(JSON.stringify({ error: "EMAIL_NOT_FOUND" }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const confirmationUrl = data.properties?.action_link;
    if (!confirmationUrl) {
      throw new Error("Recovery link was not generated");
    }

    const emailPayload = {
      sender: {
        name: "GV City",
        email: "comercial@opencity.com",
      },
      to: [{ email: normalizedEmail }],
      subject: "Recupere sua senha no GV City",
      htmlContent: generateEmailTemplate(confirmationUrl, cidadeNome || "Governador Valadares"),
      textContent:
        `Recebemos uma solicitação para redefinir sua senha. Acesse: ${confirmationUrl}`,
    };

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!response.ok) {
      const result = await response.text();
      console.error("Brevo API error:", result);
      throw new Error("Failed to send password reset email");
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("send-password-reset-email error:", error);
    return new Response(JSON.stringify({ error: "Erro ao enviar email de recuperação" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
};

serve(handler);
