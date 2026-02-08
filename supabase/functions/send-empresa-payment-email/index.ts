import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-supabase-client-lib",
};

interface PaymentEmailRequest {
  empresa_id: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[SEND-EMPRESA-PAYMENT-EMAIL] ${step}${detailsStr}`);
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
  empresaNome: string;
  cidadeNome: string;
  valorTotal: number;
  paymentUrl: string;
  expiresAt: string;
}

const generateEmailTemplate = (data: EmailData): string => {
  const expiresFormatted = formatDate(data.expiresAt);
  const valorFormatted = formatCurrency(data.valorTotal);
  const valorMensal = formatCurrency(data.valorTotal / 12);

  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pagamento da Empresa - ${data.cidadeNome}</title>
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
                      📍 ${data.cidadeNome}
                    </h1>
                    <p style="margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px;">
                      Guia de Serviços da cidade
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
                Sua empresa foi cadastrada com sucesso! Para ativá-la no guia de serviços, basta realizar o pagamento através do link seguro abaixo.
              </p>

              <!-- Empresa Details Card -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #f8f7fa; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" style="width: 100%;">
                      <tr>
                        <td style="padding-bottom: 16px; border-bottom: 1px solid #e5e5e5;">
                          <p style="margin: 0; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
                            Nome da Empresa
                          </p>
                          <p style="margin: 4px 0 0; color: #1a1a1a; font-size: 18px; font-weight: 600;">
                            🏪 ${data.empresaNome}
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
                                  📅 12 meses
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
                                  Valor Total (anual)
                                </p>
                                <p style="margin: 4px 0 0; color: #888; font-size: 13px;">
                                  equivalente a ${valorMensal}/mês
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

              <!-- Benefits -->
              <table role="presentation" style="width: 100%; border-collapse: collapse; background-color: #E8F5E9; border-radius: 12px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="margin: 0 0 12px; color: #2E7D32; font-size: 14px; font-weight: 600;">
                      ✨ O que você ganha:
                    </p>
                    <ul style="margin: 0; padding: 0 0 0 20px; color: #4a4a4a; font-size: 14px; line-height: 1.8;">
                      <li>Página exclusiva da empresa no app</li>
                      <li>Visibilidade para milhares de moradores</li>
                      <li>Contato direto via WhatsApp</li>
                      <li>Destaque na categoria de serviços</li>
                    </ul>
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
                      Este link expira em <strong>${expiresFormatted}</strong>. Após esse período, entre em contato para receber um novo link.
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
                          Sua empresa será analisada e ativada em poucas horas
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
                      © ${new Date().getFullYear()} ${data.cidadeNome}. Todos os direitos reservados.
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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const requestData: PaymentEmailRequest = await req.json();
    logStep("Request received", { empresa_id: requestData.empresa_id });

    if (!requestData.empresa_id) {
      throw new Error("empresa_id is required");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch empresa data with cidade info
    const { data: empresa, error: empresaError } = await supabase
      .from("rel_cidade_servico_empresa")
      .select(`
        id,
        nome,
        user_id,
        cidade_id,
        status,
        cidade:cidade_id (
          id,
          nome,
          slug,
          valor_empresa_anual
        )
      `)
      .eq("id", requestData.empresa_id)
      .maybeSingle();

    if (empresaError || !empresa) {
      logStep("Empresa not found", { error: empresaError?.message });
      throw new Error("Empresa não encontrada");
    }

    logStep("Empresa found", { nome: empresa.nome, cidade: empresa.cidade });

    // Check if already paid
    if (empresa.status === "ativo" || empresa.status === "pendente") {
      throw new Error("Esta empresa já foi paga ou está em análise!");
    }

    // Fetch user email
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(empresa.user_id);
    
    if (userError || !userData.user?.email) {
      logStep("User not found", { error: userError?.message, user_id: empresa.user_id });
      throw new Error("Usuário não encontrado");
    }

    const userEmail = userData.user.email;
    const userName = userData.user.user_metadata?.name || userEmail.split("@")[0];

    logStep("User found", { email: userEmail, name: userName });

    const cidadeData = empresa.cidade as { id: string; nome: string; slug: string; valor_empresa_anual: number };
    const valorTotal = cidadeData.valor_empresa_anual || 300;

    // Create Stripe checkout session
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    
    const successUrl = `${supabaseUrl.replace('.supabase.co', '.supabase.co').replace('//', '//')}/functions/v1/stripe-webhook?type=empresa_success&empresa_id=${empresa.id}`;
    const cancelUrl = `https://${cidadeData.slug}.lovable.app/cidade/${cidadeData.slug}/minhas-empresas`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card", "boleto"],
      line_items: [
        {
          price_data: {
            currency: "brl",
            product_data: {
              name: `Cadastro de Empresa: ${empresa.nome}`,
              description: `Anuidade no guia de serviços de ${cidadeData.nome} - 12 meses`,
            },
            unit_amount: Math.round(valorTotal * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `https://embryo-forge-hub.lovable.app/cidade/${cidadeData.slug}/minhas-empresas?success=true`,
      cancel_url: `https://embryo-forge-hub.lovable.app/cidade/${cidadeData.slug}/minhas-empresas?canceled=true`,
      customer_email: userEmail,
      metadata: {
        type: "empresa",
        empresa_id: empresa.id,
        cidade_id: cidadeData.id,
        user_id: empresa.user_id,
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600, // 1 hour
    });

    logStep("Stripe session created", { session_id: session.id, url: session.url });

    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    // Update empresa with payment info
    const { error: updateError } = await supabase
      .from("rel_cidade_servico_empresa")
      .update({
        stripe_session_id: session.id,
        payment_url: session.url,
        payment_expires_at: expiresAt,
      })
      .eq("id", empresa.id);

    if (updateError) {
      logStep("Warning: could not update empresa with payment info", { error: updateError.message });
    }

    // Send email via Brevo
    const emailData: EmailData = {
      to: userEmail,
      userName,
      empresaNome: empresa.nome,
      cidadeNome: cidadeData.nome,
      valorTotal,
      paymentUrl: session.url!,
      expiresAt,
    };

    const emailHtml = generateEmailTemplate(emailData);

    const brevoResponse = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "api-key": brevoApiKey,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: cidadeData.nome,
          email: "noreply@gvalley.com.br",
        },
        to: [{ email: userEmail, name: userName }],
        subject: `🏪 Finalize o cadastro da sua empresa - ${cidadeData.nome}`,
        htmlContent: emailHtml,
      }),
    });

    if (!brevoResponse.ok) {
      const errorText = await brevoResponse.text();
      logStep("Brevo error", { status: brevoResponse.status, error: errorText });
      throw new Error(`Erro ao enviar e-mail: ${errorText}`);
    }

    logStep("Email sent successfully", { to: userEmail });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "E-mail de pagamento enviado com sucesso!",
        payment_url: session.url 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
