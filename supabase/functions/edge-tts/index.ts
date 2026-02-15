import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { UniversalEdgeTTS } from "npm:edge-tts-universal@^2.0.0";

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

    // Limita o texto a 5000 caracteres para evitar abuso
    const trimmedText = text.slice(0, 5000);

    // Voz padrão: Francisca (pt-BR, feminina, neural)
    const selectedVoice = voice || "pt-BR-FranciscaNeural";

    const tts = new UniversalEdgeTTS(trimmedText, selectedVoice);
    const result = await tts.synthesize();

    return new Response(result.audio, {
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
