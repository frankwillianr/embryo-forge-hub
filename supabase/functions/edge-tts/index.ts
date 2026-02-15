import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-lib, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { text, voice } = await req.json();

    if (!text || typeof text !== "string") {
      return new Response(JSON.stringify({ error: "Campo 'text' é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const trimmedText = text.slice(0, 5000);
    const selectedVoice = voice || "pt-BR-FranciscaNeural";

    console.log("Voice requested:", voice, "| Voice used:", selectedVoice);

    // Usando a API do Edge TTS diretamente via WebSocket
    const websocketUrl = `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1?TrustedClientToken=6A5AA1D4EAFF4E9FB37E23D68491D6F4`;
    
    const requestId = crypto.randomUUID().replace(/-/g, "");
    const timestamp = new Date().toISOString();

    const configMessage = `X-Timestamp:${timestamp}\r\nContent-Type:application/json; charset=utf-8\r\nPath:speech.config\r\n\r\n{"context":{"synthesis":{"audio":{"metadataoptions":{"sentenceBoundaryEnabled":"false","wordBoundaryEnabled":"false"},"outputFormat":"audio-24khz-48kbitrate-mono-mp3"}}}}`;

    const ssml = `<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='pt-BR'><voice name='${selectedVoice}'>${trimmedText.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</voice></speak>`;

    const ssmlMessage = `X-RequestId:${requestId}\r\nContent-Type:application/ssml+xml\r\nPath:ssml\r\n\r\n${ssml}`;

    const ws = new WebSocket(websocketUrl);
    const audioChunks: Uint8Array[] = [];

    await new Promise<void>((resolve, reject) => {
      ws.onopen = () => {
        ws.send(configMessage);
        ws.send(ssmlMessage);
      };

      ws.onmessage = (event) => {
        if (typeof event.data === "string") {
          if (event.data.includes("Path:turn.end")) {
            ws.close();
            resolve();
          }
        } else if (event.data instanceof Blob) {
          event.data.arrayBuffer().then(buffer => {
            const view = new Uint8Array(buffer);
            // Pula o header (primeiros bytes até encontrar os dados de áudio)
            const headerEndIndex = view.findIndex((_, i) => 
              i > 0 && view[i - 1] === 13 && view[i] === 10 && view[i + 1] === 13 && view[i + 2] === 10
            );
            if (headerEndIndex > 0) {
              audioChunks.push(view.slice(headerEndIndex + 3));
            }
          });
        }
      };

      ws.onerror = (error) => {
        reject(new Error("WebSocket error"));
      };

      setTimeout(() => reject(new Error("Timeout")), 30000);
    });

    // Concatena todos os chunks de áudio
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.length, 0);
    const audioBuffer = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      audioBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    console.log("Audio generated, size:", audioBuffer.length);

    return new Response(audioBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Edge TTS error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro ao gerar áudio" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
