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

interface SendTarget {
  originalToken: string;
  sendToken: string;
  sourcePlatform: "ios" | "android" | "web" | "unknown";
}

interface IosConversionAttempt {
  application: string;
  sandbox: boolean;
  converted: number;
  failed: number;
}

interface IosConversionAttemptError {
  application: string;
  sandbox: boolean;
  batchSize: number;
  error: string;
}

interface FirebaseErrorInfo {
  httpStatus: number | null;
  statusText: string | null;
  googleStatus: string | null;
  fcmErrorCode: string | null;
  message: string | null;
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

function getFirebaseErrorInfo(status: number, payload: any): FirebaseErrorInfo {
  return {
    httpStatus: Number.isFinite(status) ? status : null,
    statusText: payload?.error?.status ? String(payload.error.status) : null,
    googleStatus: payload?.error?.status ? String(payload.error.status) : null,
    fcmErrorCode: getFcmErrorCode(payload),
    message: payload?.error?.message ? String(payload.error.message) : null,
  };
}

function chunkArray<T>(input: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < input.length; i += size) {
    out.push(input.slice(i, i + size));
  }
  return out;
}

async function convertApnsToFcmBatch(params: {
  apnsTokens: string[];
  accessToken: string;
  application: string;
  sandbox: boolean;
}): Promise<{
  mapped: Array<{ apnsToken: string; fcmToken: string }>;
  invalidApnsTokens: string[];
  failed: Array<{ apnsToken: string; status: string; message: string | null }>;
}> {
  const { apnsTokens, accessToken, application, sandbox } = params;
  if (!apnsTokens.length) {
    return { mapped: [], invalidApnsTokens: [], failed: [] };
  }

  const resp = await fetch("https://iid.googleapis.com/iid/v1:batchImport", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
      access_token_auth: "true",
    },
    body: JSON.stringify({
      application,
      sandbox,
      apns_tokens: apnsTokens,
    }),
  });

  const payload = await resp.json();
  if (!resp.ok) {
    throw new Error(`Erro no batchImport APNs->FCM: ${resp.status} ${JSON.stringify(payload)}`);
  }

  const results = Array.isArray(payload?.results) ? payload.results : [];
  const mapped: Array<{ apnsToken: string; fcmToken: string }> = [];
  const invalidApnsTokens: string[] = [];
  const failed: Array<{ apnsToken: string; status: string; message: string | null }> = [];

  for (let i = 0; i < apnsTokens.length; i++) {
    const apnsToken = apnsTokens[i];
    const row = results[i] || {};
    const status = String(row?.status || "UNKNOWN");
    const registrationToken = row?.registration_token ? String(row.registration_token) : null;
    const message = row?.error ? String(row.error) : null;

    if (status === "OK" && registrationToken) {
      mapped.push({ apnsToken, fcmToken: registrationToken });
      continue;
    }

    failed.push({ apnsToken, status, message });

    const statusUpper = status.toUpperCase();
    const messageUpper = (message || "").toUpperCase();
    const isInvalid =
      statusUpper.includes("INVALID") ||
      statusUpper.includes("NOT_FOUND") ||
      messageUpper.includes("INVALID") ||
      messageUpper.includes("NOT_FOUND");

    if (isInvalid) {
      invalidApnsTokens.push(apnsToken);
    }
  }

  return {
    mapped,
    invalidApnsTokens: [...new Set(invalidApnsTokens)],
    failed,
  };
}

function isLikelyApnsToken(token: string): boolean {
  return /^[A-Fa-f0-9]{64}$/.test((token || "").trim());
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

    const accessToken = await getGoogleAccessToken(serviceAccount);

    const iosBundleId = "com.frankwillianr.gvcity6";
    const iosSandbox = (Deno.env.get("IOS_APNS_SANDBOX") || "true").toLowerCase() === "true";

    const nonIosTargets: SendTarget[] = tokenRows
      .filter((row) => row.platform !== "ios")
      .map((row) => ({
        originalToken: row.device_token,
        sendToken: row.device_token,
        sourcePlatform: (row.platform as SendTarget["sourcePlatform"]) || "unknown",
      }));

    const iosRows = tokenRows.filter((row) => row.platform === "ios");
    let iosConvertedTargets: SendTarget[] = [];
    const iosDirectFcmTargets: SendTarget[] = [];
    let invalidApnsTokensFromImport: string[] = [];
    let apnsConversionFailures: Array<{ apnsToken: string; status: string; message: string | null }> = [];
    const iosAttemptsSummary: IosConversionAttempt[] = [];
    const iosAttemptErrors: IosConversionAttemptError[] = [];

    if (iosRows.length > 0) {
      const iosRawTokens = [...new Set(iosRows.map((r) => r.device_token))];
      for (const batch of chunkArray(iosRawTokens, 100)) {
        try {
          const conversion = await convertApnsToFcmBatch({
            apnsTokens: batch,
            accessToken,
            application: iosBundleId,
            sandbox: iosSandbox,
          });

          iosConvertedTargets.push(
            ...conversion.mapped.map((item) => ({
              originalToken: item.apnsToken,
              sendToken: item.fcmToken,
              sourcePlatform: "ios" as const,
            })),
          );

          invalidApnsTokensFromImport.push(...conversion.invalidApnsTokens);
          apnsConversionFailures.push(...conversion.failed);
        } catch (error) {
          console.error("Falha ao converter lote APNs->FCM", {
            batchSize: batch.length,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    const sendTargets = [...nonIosTargets, ...iosDirectFcmTargets, ...iosConvertedTargets];

    if (!sendTargets.length) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "Nenhum token valido para envio apos conversao APNs->FCM",
          iosConversion: {
            rawIosTokens: iosRows.length,
            iosAlreadyFcm: iosDirectFcmTargets.length,
            converted: iosConvertedTargets.length,
            failed: apnsConversionFailures.length,
            attempts: iosAttemptsSummary,
            attemptErrors: iosAttemptErrors,
          },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const projectId = Deno.env.get("FIREBASE_PROJECT_ID") || serviceAccount.project_id;
    const endpoint = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const invalidTokens: string[] = [];

    const results = await Promise.all(
      sendTargets.map(async (target) => {
        const payload = {
          message: {
            token: target.sendToken,
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
        const firebaseError = getFirebaseErrorInfo(resp.status, respPayload);
        const fcmErrorCode = firebaseError.fcmErrorCode;
        const topErrorMessage = firebaseError.message;

        if (
          !resp.ok &&
          target.sourcePlatform !== "ios" &&
          (fcmErrorCode === "UNREGISTERED" || fcmErrorCode === "INVALID_ARGUMENT")
        ) {
          invalidTokens.push(target.originalToken);
        }

        if (!resp.ok) {
          console.error("FCM envio falhou", {
            firebaseError,
            sourcePlatform: target.sourcePlatform,
            tokenPrefix: target.originalToken.substring(0, 20),
            tokenLength: target.originalToken.length,
          });
        }

        return {
          token: target.originalToken.substring(0, 20),
          sourcePlatform: target.sourcePlatform,
          ok: resp.ok,
          status: resp.status,
          fcmErrorCode,
          errorMessage: topErrorMessage,
          firebaseError,
          result: respPayload,
        };
      }),
    );

    const successCount = results.filter((r) => r.ok).length;
    const failureCount = results.length - successCount;
    const failureReasons = [
      ...new Set(
        results
          .filter((r) => !r.ok)
          .map((r) => r.fcmErrorCode || r.errorMessage || `HTTP_${r.status}`),
      ),
    ];

    const removableInvalidTokens = [...new Set([...invalidTokens, ...invalidApnsTokensFromImport])];

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

    if (successCount === 0) {
      console.error("Push sem entregas", {
        totalTargets: sendTargets.length,
        failureCount,
        failureReasons,
        iosConversion: {
          rawIosTokens: iosRows.length,
          iosAlreadyFcm: iosDirectFcmTargets.length,
          converted: iosConvertedTargets.length,
          failed: apnsConversionFailures.length,
          attempts: iosAttemptsSummary,
          attemptErrors: iosAttemptErrors,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: successCount > 0,
        message: responseMessage,
        sent: sendTargets.length,
        successCount,
        failureCount,
        failureReasons,
        invalidTokensRemoved: removableInvalidTokens.length,
        iosConversion: {
          rawIosTokens: iosRows.length,
          iosAlreadyFcm: iosDirectFcmTargets.length,
          converted: iosConvertedTargets.length,
          failed: apnsConversionFailures.length,
          invalidRemoved: invalidApnsTokensFromImport.length,
          attempts: iosAttemptsSummary,
          attemptErrors: iosAttemptErrors,
        },
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
