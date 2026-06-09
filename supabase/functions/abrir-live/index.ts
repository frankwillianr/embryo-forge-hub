import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type AbrirLiveRequest = {
  title?: string;
  record?: boolean;
};

const APIVIDEO_BASE_URL = "https://ws.api.video";
const RTMP_SERVER_URL = "rtmp://broadcast.api.video/s";
const RTMPS_SERVER_URL = "rtmps://broadcast.api.video:1936/s";

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function getApiVideoAccessToken(apiKey: string) {
  const response = await fetch(`${APIVIDEO_BASE_URL}/auth/api-key`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload?.access_token) {
    throw new Error(payload?.message || payload?.title || "Nao foi possivel autenticar na api.video.");
  }

  return String(payload.access_token);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Metodo nao permitido." }, 405);
  }

  try {
    const apiKey = Deno.env.get("APIVIDEO_API_KEY");
    if (!apiKey) {
      return jsonResponse({ error: "Configure o segredo APIVIDEO_API_KEY no Supabase." }, 500);
    }

    const body = (await req.json().catch(() => ({}))) as AbrirLiveRequest;
    const title = body.title?.trim() || `Live ${new Date().toLocaleString("pt-BR")}`;
    const accessToken = await getApiVideoAccessToken(apiKey);

    const createResponse = await fetch(`${APIVIDEO_BASE_URL}/live-streams`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: title,
        public: true,
        record: Boolean(body.record),
      }),
    });

    const live = await createResponse.json().catch(() => ({}));
    if (!createResponse.ok) {
      throw new Error(live?.message || live?.title || "Nao foi possivel criar a live.");
    }

    const streamKey = String(live.streamKey || live.stream_key || "");
    const srtUrl = streamKey ? `srt://broadcast.api.video:6200?streamid=${streamKey}` : "";

    return jsonResponse({
      provider: "api.video",
      liveStreamId: live.liveStreamId || live.live_stream_id || live.id || null,
      title: live.name || title,
      broadcasting: Boolean(live.broadcasting),
      streamKey,
      servers: {
        rtmp: RTMP_SERVER_URL,
        rtmps: RTMPS_SERVER_URL,
        srt: srtUrl,
      },
      urls: live.assets || live.urls || {},
      raw: live,
    });
  } catch (error) {
    console.error("[abrir-live]", error);
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Erro ao criar live." },
      500,
    );
  }
});
