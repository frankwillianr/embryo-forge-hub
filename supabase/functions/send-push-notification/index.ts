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

interface FirebaseServiceAccount {
  project_id: string;
  client_email: string;
  private_key: string;
  token_uri?: string;
}

let cachedAccessToken: { token: string; exp: number } | null = null;

const textEncoder = new TextEncoder();

function toBase64Url(input: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < input.length; i++) {
    binary += String.fromCharCode(input[i]);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodePemPrivateKey(pem: string): ArrayBuffer {
  const content = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");

  const binary = atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  return bytes.buffer;
}

async function signJwt(serviceAccount: FirebaseServiceAccount): Promise<string> {
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: serviceAccount.client_email,
    sub: serviceAccount.client_email,
    aud: tokenUri,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = toBase64Url(textEncoder.encode(JSON.stringify(header)));
  const encodedPayload = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const unsigned = `${encodedHeader}.${encodedPayload}`;

  const key = await crypto.subtle.importKey(
    "pkcs8",
    decodePemPrivateKey(serviceAccount.private_key),
    {
      name: "RSASSA-PKCS1-v1_5",
      hash: "SHA-256",
    },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    textEncoder.encode(unsigned),
  );

  return `${unsigned}.${toBase64Url(new Uint8Array(signature))}`;
}

async function getGoogleAccessToken(serviceAccount: FirebaseServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccessToken && cachedAccessToken.exp > now + 60) {
    return cachedAccessToken.token;
  }

  const assertion = await signJwt(serviceAccount);
  const tokenUri = serviceAccount.token_uri || "https://oauth2.googleapis.com/token";

  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion,
  });

  const resp = await fetch(tokenUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  const tokenData = await resp.json();
  if (!resp.ok) {
    throw new Error(`Erro ao obter access token Google: ${JSON.stringify(tokenData)}`);
  }

  const expiresIn = Number(tokenData.expires_in || 3600);
  cachedAccessToken = {
    token: tokenData.access_token,
    exp: now + expiresIn,
  };

  return tokenData.access_token;
}

function getFcmErrorCode(payload: any): string | null {
  const details = payload?.error?.details;
  if (!Array.isArray(details)) return null;

  const fcmDetail = details.find((d: any) => d?.["@type"] === "type.googleapis.com/google.firebase.fcm.v1.FcmError");
  return fcmDetail?.errorCode || null;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const serviceAccountRaw = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");
    if (!serviceAccountRaw) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON nao configurada");
    }

    const serviceAccount = JSON.parse(serviceAccountRaw) as FirebaseServiceAccount;
    if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
      throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON invalida (faltam campos obrigatorios)");
    }

    const { cidadeId, deviceToken, platform, dryRun, title, body, data }: PushNotificationRequest = await req.json();

    if (!dryRun && (!title || !body)) {
      throw new Error("title e body sao obrigatorios");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let tokens: string[] = [];

    if (deviceToken) {
      tokens = [deviceToken];
      console.log("Enviando para token especifico");
    } else if (cidadeId) {
      let query = supabase
        .from("rel_cidade_push_tokens")
        .select("device_token")
        .eq("cidade_id", cidadeId);

      if (platform) {
        query = query.eq("platform", platform);
      }

      const { data: tokensData, error } = await query;
      if (error) throw new Error(`Erro ao buscar tokens: ${error.message}`);

      tokens = tokensData?.map((t) => t.device_token) || [];
      console.log(`Encontrados ${tokens.length} tokens para cidade ${cidadeId}`);
    } else {
      const { data: tokensData, error } = await supabase
        .from("rel_cidade_push_tokens")
        .select("device_token");

      if (error) throw new Error(`Erro ao buscar tokens: ${error.message}`);

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
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!tokens.length) {
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum token encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = await getGoogleAccessToken(serviceAccount);
    const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || serviceAccount.project_id;
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const invalidTokens: string[] = [];

    const results = await Promise.all(
      tokens.map(async (token) => {
        const payload = {
          message: {
            token,
            notification: {
              title,
              body,
            },
            data: data || {},
            android: {
              priority: "high",
              notification: {
                channel_id: "default",
                sound: "default",
              },
            },
            apns: {
              headers: {
                "apns-priority": "10",
              },
              payload: {
                aps: {
                  sound: "default",
                  badge: 1,
                },
              },
            },
          },
        };

        const resp = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(payload),
        });

        const respPayload = await resp.json();
        const fcmErrorCode = getFcmErrorCode(respPayload);

        if (!resp.ok && (fcmErrorCode === "UNREGISTERED" || fcmErrorCode === "INVALID_ARGUMENT")) {
          invalidTokens.push(token);
        }

        return {
          token: token.substring(0, 20),
          ok: resp.ok,
          status: resp.status,
          fcmErrorCode,
          result: respPayload,
        };
      }),
    );

    const successCount = results.filter((r) => r.ok).length;
    const failureCount = results.length - successCount;

    if (invalidTokens.length > 0) {
      const { error: deleteError } = await supabase
        .from("rel_cidade_push_tokens")
        .delete()
        .in("device_token", invalidTokens);

      if (deleteError) {
        console.error("Erro ao limpar tokens invalidos:", deleteError.message);
      } else {
        console.log(`Tokens invalidos removidos: ${invalidTokens.length}`);
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
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const err = error as Error;
    console.error("Erro ao enviar push:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
