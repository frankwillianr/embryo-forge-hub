import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // GET - Listar jornais
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const cidadeId = url.searchParams.get('cidade_id');
      const cidadeSlug = url.searchParams.get('cidade');
      const idExterno = url.searchParams.get('id_externo');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      console.log(`GET jornal - cidade_id: ${cidadeId}, cidade_slug: ${cidadeSlug}, id_externo: ${idExterno}`);

      // Resolver cidade por slug se necessário
      let resolvedCidadeId = cidadeId;
      if (cidadeSlug && !cidadeId) {
        const { data: cidade, error: cidadeError } = await supabase
          .from('cidade')
          .select('id')
          .eq('slug', cidadeSlug)
          .single();

        if (cidadeError || !cidade) {
          return new Response(
            JSON.stringify({ error: 'Cidade não encontrada', details: `Slug "${cidadeSlug}" não existe` }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        resolvedCidadeId = cidade.id;
      }

      // Buscar por id_externo específico
      if (idExterno) {
        const { data: jornal, error } = await supabase
          .from('rel_cidade_jornal')
          .select('*')
          .eq('id_externo', idExterno)
          .maybeSingle();

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Erro ao buscar jornal', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, jornal }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar lista de jornais
      let query = supabase
        .from('rel_cidade_jornal')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (resolvedCidadeId) {
        query = query.eq('cidade_id', resolvedCidadeId);
      }

      const { data: jornais, error } = await query;

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar jornais', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, count: jornais?.length || 0, jornais }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Criar jornal
    if (req.method === 'POST') {
      const body = await req.json();
      
      console.log('POST jornal - body:', JSON.stringify(body));

      const { 
        cidade_id, 
        cidade, // aceita slug
        titulo, 
        descricao, 
        fonte, 
        video_url, 
        id_externo,
        imagens // array de URLs
      } = body;

      // Validação básica
      if (!titulo || !descricao) {
        return new Response(
          JSON.stringify({ error: 'Campos obrigatórios faltando', details: 'titulo e descricao são obrigatórios' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Resolver cidade
      let resolvedCidadeId = cidade_id;
      if (cidade && !cidade_id) {
        const { data: cidadeData, error: cidadeError } = await supabase
          .from('cidade')
          .select('id')
          .eq('slug', cidade)
          .single();

        if (cidadeError || !cidadeData) {
          return new Response(
            JSON.stringify({ error: 'Cidade não encontrada', details: `Slug "${cidade}" não existe` }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        resolvedCidadeId = cidadeData.id;
      }

      if (!resolvedCidadeId) {
        return new Response(
          JSON.stringify({ error: 'Cidade não especificada', details: 'Informe cidade_id ou cidade (slug)' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Inserir jornal
      const { data: novoJornal, error: insertError } = await supabase
        .from('rel_cidade_jornal')
        .insert({
          cidade_id: resolvedCidadeId,
          titulo,
          descricao,
          fonte: fonte || null,
          video_url: video_url || null,
          id_externo: id_externo || null,
          imagens: (imagens && Array.isArray(imagens)) ? imagens : [],
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao inserir jornal:', insertError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar jornal', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Jornal criado com sucesso:', novoJornal.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Jornal criado com sucesso',
          jornal: novoJornal 
        }),
        { status: 201, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Método não suportado' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
