import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  cidadeId?: string;
  deviceToken?: string; // Para enviar para um dispositivo específico
  title: string;
  body: string;
  data?: Record<string, string>;
}

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const firebaseServerKey = Deno.env.get("FIREBASE_SERVER_KEY");
    if (!firebaseServerKey) {
      throw new Error("FIREBASE_SERVER_KEY não configurada");
    }

    const { cidadeId, deviceToken, title, body, data }: PushNotificationRequest = await req.json();

    if (!title || !body) {
      throw new Error("title e body são obrigatórios");
    }

    let tokens: string[] = [];

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Se foi passado um token específico, usa ele
    if (deviceToken) {
      tokens = [deviceToken];
      console.log("Enviando para token específico:", deviceToken);
    } 
    // Se foi passado cidadeId, busca todos os tokens dessa cidade
    else if (cidadeId) {
      const { data: tokensData, error } = await supabase
        .from("rel_cidade_push_tokens")
        .select("device_token")
        .eq("cidade_id", cidadeId);

      if (error) {
        throw new Error(`Erro ao buscar tokens: ${error.message}`);
      }

      tokens = tokensData?.map((t) => t.device_token) || [];
      console.log(`Encontrados ${tokens.length} tokens para cidade ${cidadeId}`);
    } 
    // Se não passou nada, busca TODOS os tokens (broadcast)
    else {
      const { data: tokensData, error } = await supabase
        .from("rel_cidade_push_tokens")
        .select("device_token");

      if (error) {
        throw new Error(`Erro ao buscar tokens: ${error.message}`);
      }

      tokens = tokensData?.map((t) => t.device_token) || [];
      console.log(`Broadcast: encontrados ${tokens.length} tokens no total`);
    }

    if (tokens.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum token encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Envia para cada token (FCM Legacy API)
    const results = await Promise.all(
      tokens.map(async (token) => {
        const fcmPayload = {
          to: token,
          notification: {
            title,
            body,
            sound: "default",
            badge: 1,
          },
          data: data || {},
        };

        const response = await fetch("https://fcm.googleapis.com/fcm/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `key=${firebaseServerKey}`,
          },
          body: JSON.stringify(fcmPayload),
        });

        const result = await response.json();
        console.log(`FCM response for token ${token.substring(0, 20)}...:`, result);
        return { token: token.substring(0, 20), result };
      })
    );

    const successCount = results.filter((r) => r.result.success === 1).length;
    const failureCount = results.filter((r) => r.result.failure === 1).length;

    console.log(`Push enviado: ${successCount} sucesso, ${failureCount} falhas`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: tokens.length,
        successCount,
        failureCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro ao enviar push:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
