import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  cidadeId?: string;
  deviceToken?: string;
  platform?: "ios" | "android" | "web";
  dryRun?: boolean;
  title: string;
  body: string;
  data?: Record<string, string>;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const firebaseServerKey = Deno.env.get("FIREBASE_SERVER_KEY");
    if (!firebaseServerKey) {
      throw new Error("FIREBASE_SERVER_KEY não configurada");
    }

    const { cidadeId, deviceToken, platform, dryRun, title, body, data }: PushNotificationRequest = await req.json();

    if (!dryRun && (!title || !body)) {
      throw new Error("title e body são obrigatórios");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let tokens: string[] = [];

    if (deviceToken) {
      tokens = [deviceToken];
      console.log("Enviando para token específico");
    } else if (cidadeId) {
      let query = supabase
        .from("rel_cidade_push_tokens")
        .select("device_token")
        .eq("cidade_id", cidadeId);

      if (platform) {
        query = query.eq("platform", platform);
      }

      const { data: tokensData, error } = await query;

      if (error) {
        throw new Error(`Erro ao buscar tokens: ${error.message}`);
      }

      tokens = tokensData?.map((t) => t.device_token) || [];
      console.log(`Encontrados ${tokens.length} tokens para cidade ${cidadeId}`);
    } else {
      const { data: tokensData, error } = await supabase
        .from("rel_cidade_push_tokens")
        .select("device_token");

      if (error) {
        throw new Error(`Erro ao buscar tokens: ${error.message}`);
      }

      tokens = tokensData?.map((t) => t.device_token) || [];
      console.log(`Broadcast: encontrados ${tokens.length} tokens no total`);
    }

    tokens = [...new Set(tokens.filter(Boolean))];

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          cidadeId: cidadeId ?? null,
          platform: platform ?? "todos",
          wouldSend: tokens.length,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tokens.length) {
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum token encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const invalidTokens: string[] = [];
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

        const firstResult = Array.isArray(result?.results) ? result.results[0] : undefined;
        const errorCode = firstResult?.error;
        if (errorCode === "NotRegistered" || errorCode === "InvalidRegistration") {
          invalidTokens.push(token);
        }

        return {
          token: token.substring(0, 20),
          result,
        };
      })
    );

    const successCount = results.filter((r) => r.result.success === 1).length;
    const failureCount = results.filter((r) => r.result.failure === 1).length;

    if (invalidTokens.length > 0) {
      const { error: deleteError } = await supabase
        .from("rel_cidade_push_tokens")
        .delete()
        .in("device_token", invalidTokens);

      if (deleteError) {
        console.error("Erro ao limpar tokens inválidos:", deleteError.message);
      } else {
        console.log(`Tokens inválidos removidos: ${invalidTokens.length}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: tokens.length,
        successCount,
        failureCount,
        invalidTokensRemoved: invalidTokens.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const err = error as Error;
    console.error("Erro ao enviar push:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
