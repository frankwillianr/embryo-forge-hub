import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-client-lib",
};

interface PaymentEmailRequest {
  // Direct fields (original API)
  to?: string;
  userName?: string;
  bannerTitulo?: string;
  cidadeNome?: string;
  diasComprados?: number;
  valorTotal?: number;
  paymentUrl?: string;
  expiresAt?: string;
  // Alternative: just pass banner_id and we fetch everything
  banner_id?: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-BANNER-PAYMENT-EMAIL] ${step}${detailsStr}`);
};

const formatCurrency = (value: number): string => {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

interface EmailData {
  to: string;
  userName: string;
  bannerTitulo: string;
  cidadeNome: string;
  diasComprados: number;
  valorTotal: number;
  paymentUrl: string;
  expiresAt: string;
}

const generateEmailTemplate = (data: EmailData): string => {
  const expiresFormatted = formatDate(data.expiresAt);
  const valorFormatted = formatCurrency(data.valorTotal);

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento do Banner - Open City</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" style="width: 100%; border-collapse: collapse;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" style="width: 100%; max-width: 600px; border-collapse: collapse; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #331D4A 0%, #4A2D6A 100%); padding: 40px 40px 30px;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td>
                    <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">
                      🎯 Open City
                    </h1>
                    <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">
                      Sua cidade na palma da mão
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 16px; color: #1a1a1a; font-size: 22px; font-weight: 600;">
                Olá, ${data.userName}! 👋
              </h2>
              
              <p style="margin: 0 0 24px; color: #4a4a4a; font-size: 16px; line-height: 1.6;">
                Seu anúncio de banner está quase pronto! Para ativá-lo, basta realizar o pagamento através do link seguro abaixo.
              </p>

              <!-- Banner Details Card -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f7fa; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid #e5e5e5;">
                          <p style="margin: 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                            Título do Banner
                          </p>
                          <p style="margin: 4px 0 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">
                            ${data.bannerTitulo}
                          </p>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 16px 0; border-bottom: 1px solid #e5e5e5;">
                          <table role="presentation" style="width: 100%;">
                            <tr>
                              <td style="width: 50%;">
                                <p style="margin: 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                  Cidade
                                </p>
                                <p style="margin: 4px 0 0; color: #1a1a1a; font-size: 16px; font-weight: 500;">
                                  📍 ${data.cidadeNome}
                                </p>
                              </td>
                              <td style="width: 50%;">
                                <p style="margin: 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                  Período
                                </p>
                                <p style="margin: 4px 0 0; color: #1a1a1a; font-size: 16px; font-weight: 500;">
                                  📅 ${data.diasComprados} dias
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding-top: 16px;">
                          <table role="presentation" style="width: 100%;">
                            <tr>
                              <td>
                                <p style="margin: 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                                  Valor Total
                                </p>
                              </td>
                              <td align="right">
                                <p style="margin: 0; color: #331D4A; font-size: 28px; font-weight: 700;">
                                  ${valorFormatted}
                                </p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <!-- CTA Button -->
              <table role="presentation" style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td align="center" style="padding: 8px 0 24px;">
                    <a href="${data.paymentUrl}" target="_blank" style="display: inline-block; background: linear-gradient(135deg, #331D4A 0%, #4A2D6A 100%); color: #ffffff; text-decoration: none; padding: 16px 48px; border-radius: 12px; font-size: 18px; font-weight: 600; box-shadow: 0 4px 16px rgba(51,29,74,0.3);">
                      💳 Realizar Pagamento
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Warning Box -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #FFF8E6; border-radius: 12px; border-left: 4px solid #F5A623;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <p style="margin: 0; color: #8B6914; font-size: 14px; font-weight: 600;">
                      ⏰ Atenção: Link válido por 1 hora
                    </p>
                    <p style="margin: 8px 0 0; color: #A67C00; font-size: 13px;">
                      Este link expira em <strong>${expiresFormatted}</strong>. Após esse período, você precisará criar um novo anúncio.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Steps -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; margin-top: 32px;">
                <tr>
                  <td>
                    <p style="margin: 0 0 16px; color: #1a1a1a; font-size: 16px; font-weight: 600;">
                      Próximos passos:
                    </p>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table role="presentation">
                      <tr>
                        <td style="width: 32px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background-color: #331D4A; color: #fff; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">1</span>
                        </td>
                        <td style="color: #4a4a4a; font-size: 14px; line-height: 1.5;">
                          Clique no botão acima para acessar o checkout seguro
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table role="presentation">
                      <tr>
                        <td style="width: 32px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background-color: #331D4A; color: #fff; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">2</span>
                        </td>
                        <td style="color: #4a4a4a; font-size: 14px; line-height: 1.5;">
                          Complete o pagamento via Pix, cartão ou boleto
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 8px 0;">
                    <table role="presentation">
                      <tr>
                        <td style="width: 32px; vertical-align: top;">
                          <span style="display: inline-block; width: 24px; height: 24px; background-color: #331D4A; color: #fff; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: 600;">3</span>
                        </td>
                        <td style="color: #4a4a4a; font-size: 14px; line-height: 1.5;">
                          Seu banner será analisado e ativado em poucas horas
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f7fa; padding: 24px 40px; border-top: 1px solid #e5e5e5;">
              <table role="presentation" style="width: 100%;">
                <tr>
                  <td align="center">
                    <p style="margin: 0 0 8px; color: #666; font-size: 13px;">
                      Dúvidas? Responda este e-mail ou entre em contato conosco.
                    </p>
                    <p style="margin: 0; color: #999; font-size: 12px;">
                      © ${new Date().getFullYear()} Open City. Todos os direitos reservados.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const brevoApiKey = Deno.env.get("BREVO_API_KEY");
    if (!brevoApiKey) {
      throw new Error("BREVO_API_KEY not configured");
    }

    const requestData: PaymentEmailRequest = await req.json();
    logStep("Request received", { 
      banner_id: requestData.banner_id, 
      to: requestData.to,
      bannerTitulo: requestData.bannerTitulo 
    });

    let emailData: EmailData;

    // If banner_id is provided, fetch all data from database
    if (requestData.banner_id) {
      logStep("Fetching data from database for banner_id", { banner_id: requestData.banner_id });

      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Fetch payment record
      const { data: pagamento, error: pagError } = await supabase
        .from("pagamento_banner")
        .select("*")
        .eq("banner_id", requestData.banner_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pagError) {
        logStep("Error fetching pagamento", { error: pagError.message });
        throw new Error("Erro ao buscar dados do pagamento: " + pagError.message);
      }

      if (!pagamento) {
        throw new Error("Nenhum registro de pagamento encontrado para este banner");
      }

      logStep("Pagamento found", { 
        pagamento_id: pagamento.id, 
        status: pagamento.status,
        stripe_session_id: pagamento.stripe_session_id 
      });

      // Check if there's a valid payment URL
      if (!pagamento.stripe_session_id) {
        throw new Error("Este banner não possui sessão de pagamento. Crie um novo link de pagamento.");
      }

      // Check if payment is still pending
      if (pagamento.status !== "pendente") {
        throw new Error(`Pagamento já está com status: ${pagamento.status}`);
      }

      // Check if payment link has expired
      if (pagamento.expira_em && new Date(pagamento.expira_em) < new Date()) {
        throw new Error("O link de pagamento expirou. Crie um novo anúncio.");
      }

      // Fetch banner data
      const { data: banner, error: bannerError } = await supabase
        .from("banner")
        .select("titulo")
        .eq("id", requestData.banner_id)
        .maybeSingle();

      if (bannerError || !banner) {
        throw new Error("Banner não encontrado");
      }

      // Fetch cidade data
      const { data: cidade, error: cidadeError } = await supabase
        .from("cidade")
        .select("nome")
        .eq("id", pagamento.cidade_id)
        .maybeSingle();

      if (cidadeError || !cidade) {
        throw new Error("Cidade não encontrada");
      }

      // Fetch user profile for email and name
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("nome, email")
        .eq("id", pagamento.user_id)
        .maybeSingle();

      // Get email from auth.users if not in profile
      let userEmail = profile?.email;
      let userName = profile?.nome || "Cliente";

      if (!userEmail) {
        const { data: authUser } = await supabase.auth.admin.getUserById(pagamento.user_id);
        userEmail = authUser?.user?.email;
      }

      if (!userEmail) {
        throw new Error("Não foi possível encontrar o email do usuário");
      }

      // Construct payment URL from stripe session
      // The URL format for Stripe Checkout is: https://checkout.stripe.com/c/pay/{session_id}
      const paymentUrl = `https://checkout.stripe.com/c/pay/${pagamento.stripe_session_id}`;

      emailData = {
        to: userEmail,
        userName: userName,
        bannerTitulo: banner.titulo || "Sem título",
        cidadeNome: cidade.nome,
        diasComprados: pagamento.dias_comprados,
        valorTotal: pagamento.valor,
        paymentUrl: paymentUrl,
        expiresAt: pagamento.expira_em || new Date(Date.now() + 3600000).toISOString(),
      };
    } else {
      // Use directly provided fields (original behavior)
      if (!requestData.to || !requestData.paymentUrl) {
        throw new Error("Missing required fields: to, paymentUrl");
      }

      emailData = {
        to: requestData.to,
        userName: requestData.userName || "Cliente",
        bannerTitulo: requestData.bannerTitulo || "Seu Banner",
        cidadeNome: requestData.cidadeNome || "Sua Cidade",
        diasComprados: requestData.diasComprados || 0,
        valorTotal: requestData.valorTotal || 0,
        paymentUrl: requestData.paymentUrl,
        expiresAt: requestData.expiresAt || new Date(Date.now() + 3600000).toISOString(),
      };
    }

    logStep("Email data prepared", { to: emailData.to, bannerTitulo: emailData.bannerTitulo });

    const htmlContent = generateEmailTemplate(emailData);

    const emailPayload = {
      sender: {
        name: "Open City",
        email: "comercial@opencity.com",
      },
      to: [{ email: emailData.to }],
      subject: `🎯 Finalize seu anúncio: ${emailData.bannerTitulo}`,
      htmlContent,
    };

    logStep("Sending email via Brevo", { to: emailData.to });

    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": brevoApiKey,
        "content-type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    const result = await response.json();

    if (!response.ok) {
      logStep("Brevo API error", result);
      throw new Error(result.message || "Failed to send email");
    }

    logStep("Email sent successfully", { messageId: result.messageId });

    return new Response(
      JSON.stringify({ success: true, messageId: result.messageId }),
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