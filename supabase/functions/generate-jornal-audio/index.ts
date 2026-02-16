import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { jornalId } = await req.json();

    if (!jornalId) {
      return new Response(
        JSON.stringify({ error: "jornalId é obrigatório" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Criar cliente Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Buscar dados do jornal
    const { data: jornal, error: jornalError } = await supabaseClient
      .from("rel_cidade_jornal")
      .select("id, titulo, descricao, audio_url")
      .eq("id", jornalId)
      .single();

    if (jornalError || !jornal) {
      return new Response(
        JSON.stringify({ error: "Jornal não encontrado" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Se já tem áudio, retornar a URL existente
    if (jornal.audio_url) {
      console.log("Audio already exists:", jornal.audio_url);
      return new Response(
        JSON.stringify({ audioUrl: jornal.audio_url, cached: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Preparar texto para TTS
    const text = `${jornal.titulo}. ${jornal.descricao || ""}`.slice(0, 5000);

    console.log("Generating audio for jornal:", jornalId);

    // Usar Google Cloud Text-to-Speech API
    const googleApiKey = Deno.env.get("GOOGLE_TTS_API_KEY");

    if (!googleApiKey) {
      console.error("GOOGLE_TTS_API_KEY não configurada, usando fallback");
      // Fallback: usar edge-tts via HTTP
      const ttsUrl = `https://tts.voicetech.yandex.net/generate?text=${encodeURIComponent(text)}&format=mp3&lang=pt-BR&speaker=oksana`;

      // Atualizar com a URL externa (temporário)
      await supabaseClient
        .from("rel_cidade_jornal")
        .update({ audio_url: ttsUrl })
        .eq("id", jornalId);

      return new Response(
        JSON.stringify({ audioUrl: ttsUrl, cached: false, fallback: true }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Chamar Google Cloud TTS API
    const googleResponse = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: { text },
          voice: {
            languageCode: 'pt-BR',
            name: 'pt-BR-Wavenet-A', // Voz neural feminina
            ssmlGender: 'FEMALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            pitch: 0.0,
            speakingRate: 1.0,
          },
        }),
      }
    );

    if (!googleResponse.ok) {
      const error = await googleResponse.text();
      console.error('Google TTS error:', error);
      throw new Error('Erro ao gerar áudio com Google TTS');
    }

    const googleData = await googleResponse.json();
    const audioBase64 = googleData.audioContent;

    // Converter base64 para Uint8Array
    const audioBytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));

    console.log("Audio generated, size:", audioBytes.byteLength);

    // Upload para Supabase Storage
    const fileName = `jornal-${jornalId}-${Date.now()}.mp3`;
    const { error: uploadError } = await supabaseClient
      .storage
      .from("jornal-audios")
      .upload(fileName, audioBytes, {
        contentType: "audio/mpeg",
        cacheControl: "31536000", // 1 ano de cache
        upsert: false,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return new Response(
        JSON.stringify({ error: "Erro ao fazer upload do áudio" }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Obter URL pública
    const { data: publicUrlData } = supabaseClient
      .storage
      .from("jornal-audios")
      .getPublicUrl(fileName);

    const audioUrl = publicUrlData.publicUrl;

    // Atualizar registro do jornal com a URL do áudio
    const { error: updateError } = await supabaseClient
      .from("rel_cidade_jornal")
      .update({ audio_url: audioUrl })
      .eq("id", jornalId);

    if (updateError) {
      console.error("Update error:", updateError);
    }

    console.log("Audio URL saved:", audioUrl);

    return new Response(
      JSON.stringify({ audioUrl, cached: false }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro ao gerar áudio",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
