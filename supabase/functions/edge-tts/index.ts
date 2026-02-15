import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { EdgeTTS } from "jsr:@edge-tts/universal@^1.3.3";

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

    const tts = new EdgeTTS();
    await tts.synthesize(trimmedText, selectedVoice, {
      rate: "+0%",
      volume: "+0%",
      pitch: "+0Hz",
    });

    const audioBuffer = tts.toBuffer();
    console.log("Audio generated, size:", audioBuffer.byteLength);

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
