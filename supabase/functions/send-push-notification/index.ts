import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PushNotificationRequest {
  cidadeId?: string;
  deviceToken?: string;
  userId?: string;
  userIds?: string[];
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

interface PushTokenRow {
  device_token: string;
  platform: "ios" | "android" | "web" | null;
}

interface FirebaseErrorInfo {
  httpStatus: number | null;
  statusText: string | null;
  googleStatus: string | null;
  fcmErrorCode: string | null;
  message: string | null;
}

interface FcmSendResult {
  token: string;
  ok: boolean;
  status: number;
  fcmErrorCode: string | null;
  errorMessage: string | null;
  firebaseError: FirebaseErrorInfo;
  result: any;
}

interface ApnsSendResult {
  token: string;
  ok: boolean;
  status: number;
  reason: string | null;
}

let cachedAccessToken: { token: string; exp: number } | null = null;
let cachedApnsJwt: { token: string; exp: number } | null = null;
let cachedApnsKey: CryptoKey | null = null;

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

function getFirebaseErrorInfo(status: number, payload: any): FirebaseErrorInfo {
  return {
    httpStatus: Number.isFinite(status) ? status : null,
    statusText: payload?.error?.status ? String(payload.error.status) : null,
    googleStatus: payload?.error?.status ? String(payload.error.status) : null,
    fcmErrorCode: getFcmErrorCode(payload),
    message: payload?.error?.message ? String(payload.error.message) : null,
  };
}

async function getApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedApnsJwt && cachedApnsJwt.exp > now + 60) {
    return cachedApnsJwt.token;
  }

  const apnsKeyP8 = Deno.env.get("APNS_KEY_P8");
  if (!apnsKeyP8) {
    throw new Error("APNS_KEY_P8 nao configurada");
  }

  const apnsKeyId = Deno.env.get("APNS_KEY_ID") || "TGVSQS36VH";
  const apnsTeamId = Deno.env.get("APNS_TEAM_ID") || "P5T8N69HM9";

  if (!cachedApnsKey) {
    cachedApnsKey = await crypto.subtle.importKey(
      "pkcs8",
      decodePemPrivateKey(apnsKeyP8),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["sign"],
    );
  }

  const header = { alg: "ES256", kid: apnsKeyId };
  const payload = { iss: apnsTeamId, iat: now };

  const encodedHeader = toBase64Url(textEncoder.encode(JSON.stringify(header)));
  const encodedPayload = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const unsigned = `${encodedHeader}.${encodedPayload}`;

  const signatureBuffer = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    cachedApnsKey,
    textEncoder.encode(unsigned),
  );

  const signatureBytes = new Uint8Array(signatureBuffer);
  let rawSig: Uint8Array;

  if (signatureBytes[0] === 0x30) {
    let offset = 2;
    const rLen = signatureBytes[offset + 1];
    let r = signatureBytes.slice(offset + 2, offset + 2 + rLen);
    offset = offset + 2 + rLen;
    const sLen = signatureBytes[offset + 1];
    let s = signatureBytes.slice(offset + 2, offset + 2 + sLen);

    if (r.length > 32) r = r.slice(r.length - 32);
    if (s.length > 32) s = s.slice(s.length - 32);
    if (r.length < 32) {
      const padded = new Uint8Array(32);
      padded.set(r, 32 - r.length);
      r = padded;
    }
    if (s.length < 32) {
      const padded = new Uint8Array(32);
      padded.set(s, 32 - s.length);
      s = padded;
    }

    rawSig = new Uint8Array(64);
    rawSig.set(r, 0);
    rawSig.set(s, 32);
  } else {
    rawSig = signatureBytes;
  }

  const token = `${unsigned}.${toBase64Url(rawSig)}`;
  cachedApnsJwt = { token, exp: now + 1800 };
  return token;
}

async function sendViaApns(params: {
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  bundleId: string;
  sandbox: boolean;
}): Promise<ApnsSendResult> {
  const { deviceToken, title, body, data, bundleId, sandbox } = params;

  const host = sandbox
    ? "https://api.sandbox.push.apple.com"
    : "https://api.push.apple.com";
  const url = `${host}/3/device/${deviceToken}`;

  const apnsPayload = {
    aps: {
      alert: { title, body },
      sound: "default",
      badge: 1,
    },
    ...(data || {}),
  };

  const jwt = await getApnsJwt();

  const resp = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": bundleId,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(apnsPayload),
  });

  let reason: string | null = null;
  if (!resp.ok) {
    try {
      const errPayload = await resp.json();
      reason = errPayload?.reason ? String(errPayload.reason) : null;
    } catch {
      reason = null;
    }
  } else {
    await resp.text().catch(() => {});
  }

  return {
    token: deviceToken,
    ok: resp.ok,
    status: resp.status,
    reason,
  };
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

    const { cidadeId, deviceToken, userId, userIds, platform, dryRun, title, body, data }: PushNotificationRequest = await req.json();

    if (!dryRun && (!title || !body)) {
      throw new Error("title e body sao obrigatorios");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let tokenRows: PushTokenRow[] = [];
    const normalizedUserIds = [
      ...(userId ? [userId] : []),
      ...(Array.isArray(userIds) ? userIds : []),
    ]
      .map((id) => String(id || "").trim())
      .filter(Boolean);
    const uniqueUserIds = [...new Set(normalizedUserIds)];

    if (deviceToken) {
      tokenRows = [
        {
          device_token: deviceToken,
          platform: (platform as PushTokenRow["platform"]) ?? null,
        },
      ];
      console.log("Enviando para token especifico");
    } else if (uniqueUserIds.length > 0) {
      let query = supabase
        .from("rel_cidade_push_tokens")
        .select("device_token, platform")
        .in("user_id", uniqueUserIds);

      if (cidadeId) {
        query = query.eq("cidade_id", cidadeId);
      }

      if (platform) {
        query = query.eq("platform", platform);
      }

      const { data: tokensData, error } = await query;
      if (error) throw new Error(`Erro ao buscar tokens por usuario: ${error.message}`);

      tokenRows = (tokensData as PushTokenRow[] | null) || [];
      console.log(`Encontrados ${tokenRows.length} tokens para ${uniqueUserIds.length} usuario(s)`);
    } else if (cidadeId) {
      let query = supabase
        .from("rel_cidade_push_tokens")
        .select("device_token, platform")
        .eq("cidade_id", cidadeId);

      if (platform) {
        query = query.eq("platform", platform);
      }

      const { data: tokensData, error } = await query;
      if (error) throw new Error(`Erro ao buscar tokens: ${error.message}`);

      tokenRows = (tokensData as PushTokenRow[] | null) || [];
      console.log(`Encontrados ${tokenRows.length} tokens para cidade ${cidadeId}`);
    } else {
      const { data: tokensData, error } = await supabase
        .from("rel_cidade_push_tokens")
        .select("device_token, platform");

      if (error) throw new Error(`Erro ao buscar tokens: ${error.message}`);

      tokenRows = (tokensData as PushTokenRow[] | null) || [];
      console.log(`Broadcast: encontrados ${tokenRows.length} tokens no total`);
    }

    tokenRows = tokenRows.filter((row) => !!row?.device_token);
    const uniqueTokenRowsMap = new Map<string, PushTokenRow>();
    for (const row of tokenRows) {
      const prev = uniqueTokenRowsMap.get(row.device_token);
      if (!prev) {
        uniqueTokenRowsMap.set(row.device_token, row);
      } else if (!prev.platform && row.platform) {
        uniqueTokenRowsMap.set(row.device_token, row);
      }
    }
    tokenRows = [...uniqueTokenRowsMap.values()];

    if (dryRun) {
      const iosRawCount = tokenRows.filter((r) => r.platform === "ios").length;
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          cidadeId: cidadeId ?? null,
          userIds: uniqueUserIds,
          platform: platform ?? "todos",
          wouldSend: tokenRows.length,
          iosRawCount,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!tokenRows.length) {
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum token encontrado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const iosBundleId = "com.frankwillianr.gvcity6";
    const iosSandbox = (Deno.env.get("IOS_APNS_SANDBOX") || "true").toLowerCase() === "true";

    const iosRows = tokenRows.filter((row) => row.platform === "ios");
    const nonIosRows = tokenRows.filter((row) => row.platform !== "ios");

    const fcmInvalidTokens: string[] = [];
    const fcmResults: FcmSendResult[] = [];

    if (nonIosRows.length > 0) {
      const accessToken = await getGoogleAccessToken(serviceAccount);
      const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || serviceAccount.project_id;
      const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

      const results = await Promise.all(
        nonIosRows.map(async (row) => {
          const payload = {
            message: {
              token: row.device_token,
              notification: { title, body },
              data: data || {},
              android: {
                priority: "high",
                notification: {
                  channel_id: "default",
                  sound: "default",
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
          const firebaseError = getFirebaseErrorInfo(resp.status, respPayload);
          const fcmErrorCode = firebaseError.fcmErrorCode;

          if (!resp.ok && (fcmErrorCode === "UNREGISTERED" || fcmErrorCode === "INVALID_ARGUMENT")) {
            fcmInvalidTokens.push(row.device_token);
          }

          if (!resp.ok) {
            console.error("FCM envio falhou", {
              firebaseError,
              platform: row.platform,
              tokenPrefix: row.device_token.substring(0, 20),
            });
          }

          return {
            token: row.device_token.substring(0, 20),
            ok: resp.ok,
            status: resp.status,
            fcmErrorCode,
            errorMessage: firebaseError.message,
            firebaseError,
            result: respPayload,
          };
        }),
      );

      fcmResults.push(...results);
    }

    const apnsInvalidTokens: string[] = [];
    const apnsResults: ApnsSendResult[] = [];

    if (iosRows.length > 0) {
      const results = await Promise.all(
        iosRows.map(async (row) => {
          try {
            const r = await sendViaApns({
              deviceToken: row.device_token,
              title,
              body,
              data,
              bundleId: iosBundleId,
              sandbox: iosSandbox,
            });

            if (!r.ok && r.reason) {
              const invalidReasons = ["BadDeviceToken", "Unregistered", "DeviceTokenNotForTopic"];
              if (invalidReasons.includes(r.reason)) {
                apnsInvalidTokens.push(row.device_token);
              }
            }

            if (!r.ok) {
              console.error("APNs envio falhou", {
                status: r.status,
                reason: r.reason,
                tokenPrefix: row.device_token.substring(0, 20),
              });
            }

            return {
              token: row.device_token.substring(0, 20),
              ok: r.ok,
              status: r.status,
              reason: r.reason,
            };
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error("APNs erro inesperado", {
              message,
              tokenPrefix: row.device_token.substring(0, 20),
            });
            return {
              token: row.device_token.substring(0, 20),
              ok: false,
              status: 0,
              reason: message,
            };
          }
        }),
      );

      apnsResults.push(...results);
    }

    const fcmSuccess = fcmResults.filter((r) => r.ok).length;
    const fcmFailure = fcmResults.length - fcmSuccess;
    const apnsSuccess = apnsResults.filter((r) => r.ok).length;
    const apnsFailure = apnsResults.length - apnsSuccess;

    const successCount = fcmSuccess + apnsSuccess;
    const failureCount = fcmFailure + apnsFailure;
    const total = fcmResults.length + apnsResults.length;

    const failureReasons = [
      ...new Set([
        ...fcmResults
          .filter((r) => !r.ok)
          .map((r) => r.fcmErrorCode || r.errorMessage || `HTTP_${r.status}`),
        ...apnsResults
          .filter((r) => !r.ok)
          .map((r) => r.reason || `HTTP_${r.status}`),
      ]),
    ];

    const removableInvalidTokens = [...new Set([...fcmInvalidTokens, ...apnsInvalidTokens])];
    if (removableInvalidTokens.length > 0) {
      const { error: deleteError } = await supabase
        .from("rel_cidade_push_tokens")
        .delete()
        .in("device_token", removableInvalidTokens);

      if (deleteError) {
        console.error("Erro ao limpar tokens invalidos:", deleteError.message);
      } else {
        console.log(`Tokens invalidos removidos: ${removableInvalidTokens.length}`);
      }
    }

    const primaryFailureReason = failureReasons[0] || null;
    const responseMessage =
      successCount > 0
        ? "Push processado"
        : primaryFailureReason
          ? `Nenhum push entregue (${primaryFailureReason})`
          : "Nenhum push entregue";

    if (successCount === 0 && total > 0) {
      console.error("Push sem entregas", {
        total,
        failureReasons,
        fcm: { total: fcmResults.length, failure: fcmFailure },
        apns: { total: apnsResults.length, failure: apnsFailure },
      });
    }

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: responseMessage,
        sent: total,
        successCount,
        failureCount,
        failureReasons,
        invalidTokensRemoved: removableInvalidTokens.length,
        android: {
          sent: fcmResults.length,
          successCount: fcmSuccess,
          failureCount: fcmFailure,
          results: fcmResults,
        },
        ios: {
          sent: apnsResults.length,
          successCount: apnsSuccess,
          failureCount: apnsFailure,
          sandbox: iosSandbox,
          bundleId: iosBundleId,
          results: apnsResults,
        },
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
