import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Parse query params
    const url = new URL(req.url);
    const cidadeId = url.searchParams.get('cidade_id');
    const cidadeSlug = url.searchParams.get('cidade'); // Aceita slug como "gv"
    const apenasAtivos = url.searchParams.get('ativos') !== 'false'; // default true

    console.log(`Buscando banners - cidade_id: ${cidadeId}, cidade_slug: ${cidadeSlug}, ativos: ${apenasAtivos}`);

    // Se passou slug, buscar o ID da cidade primeiro
    let resolvedCidadeId = cidadeId;
    if (cidadeSlug && !cidadeId) {
      const { data: cidade, error: cidadeError } = await supabase
        .from('cidade')
        .select('id')
        .eq('slug', cidadeSlug)
        .single();

      if (cidadeError || !cidade) {
        console.error('Cidade não encontrada:', cidadeSlug);
        return new Response(
          JSON.stringify({ error: 'Cidade não encontrada', details: `Slug "${cidadeSlug}" não existe` }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      resolvedCidadeId = cidade.id;
      console.log(`Slug "${cidadeSlug}" resolvido para ID: ${resolvedCidadeId}`);
    }

    // Build query
    let query = supabase
      .from('banner')
      .select(`
        id,
        id_externo,
        titulo,
        descricao,
        imagem_url,
        video_youtube_url,
        video_upload_url,
        dias_comprados,
        dias_usados,
        ativo,
        status,
        created_at,
        updated_at,
        rel_cidade_banner!inner(cidade_id)
      `);

    // Filter by cidade if provided
    if (resolvedCidadeId) {
      query = query.eq('rel_cidade_banner.cidade_id', resolvedCidadeId);
    }

    // Filter only active banners if requested
    if (apenasAtivos) {
      query = query.eq('ativo', true).eq('status', 'ativo');
    }

    const { data: banners, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar banners:', error);
      return new Response(
        JSON.stringify({ error: 'Erro ao buscar banners', details: error.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format response
    const response = banners.map(banner => ({
      id: banner.id,
      id_externo: banner.id_externo,
      titulo: banner.titulo,
      descricao: banner.descricao,
      imagem_url: banner.imagem_url,
      video_youtube_url: banner.video_youtube_url,
      video_upload_url: banner.video_upload_url,
      dias_comprados: banner.dias_comprados,
      dias_usados: banner.dias_usados,
      ativo: banner.ativo,
      status: banner.status,
      created_at: banner.created_at,
      updated_at: banner.updated_at,
    }));

    console.log(`Retornando ${response.length} banners`);

    return new Response(
      JSON.stringify({ 
        success: true,
        count: response.length,
        banners: response 
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro inesperado:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
