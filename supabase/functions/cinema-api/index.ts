import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // GET - Listar filmes
    if (req.method === 'GET') {
      const url = new URL(req.url);
      const cidadeId = url.searchParams.get('cidade_id');
      const cidadeSlug = url.searchParams.get('cidade');
      const idExterno = url.searchParams.get('id_externo');
      const limit = parseInt(url.searchParams.get('limit') || '50');

      // Resolver cidade por slug
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
        const { data: filme, error } = await supabase
          .from('rel_cidade_cinema')
          .select('*')
          .eq('id_externo', idExterno)
          .maybeSingle();

        if (error) {
          return new Response(
            JSON.stringify({ error: 'Erro ao buscar filme', details: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, filme }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Buscar lista de filmes
      let query = supabase
        .from('rel_cidade_cinema')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (resolvedCidadeId) {
        query = query.eq('cidade_id', resolvedCidadeId);
      }

      const { data: filmes, error } = await query;

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar filmes', details: error.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, count: filmes?.length || 0, filmes }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // POST - Criar filme
    if (req.method === 'POST') {
      const body = await req.json();

      const {
        cidade_id,
        cidade, // aceita slug
        nome_filme,
        sinopse,
        nome_cinema,
        banner_url,
        trailer_url,
        horarios,
        id_externo,
      } = body;

      // Validação básica
      if (!nome_filme || !nome_cinema) {
        return new Response(
          JSON.stringify({ error: 'Campos obrigatórios faltando', details: 'nome_filme e nome_cinema são obrigatórios' }),
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

      // Verificar id_externo duplicado
      if (id_externo) {
        const { data: existente } = await supabase
          .from('rel_cidade_cinema')
          .select('id')
          .eq('id_externo', id_externo)
          .maybeSingle();

        if (existente) {
          return new Response(
            JSON.stringify({ error: 'ID externo já existe', details: `Já existe um filme com id_externo "${id_externo}"`, filme_id: existente.id }),
            { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }

      // Inserir filme
      const { data: novoFilme, error: insertError } = await supabase
        .from('rel_cidade_cinema')
        .insert({
          cidade_id: resolvedCidadeId,
          nome_filme,
          sinopse: sinopse || null,
          nome_cinema,
          banner_url: banner_url || null,
          trailer_url: trailer_url || null,
          horarios: horarios || [],
          id_externo: id_externo || null,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Erro ao inserir filme:', insertError);
        return new Response(
          JSON.stringify({ error: 'Erro ao criar filme', details: insertError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Filme criado com sucesso', filme: novoFilme }),
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
