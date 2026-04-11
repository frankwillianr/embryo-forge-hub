import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 100;

interface RequestBody {
  cidade_id: string;
  limit?: number;
}

interface NoticiaRow {
  id: string;
  cidade_id: string;
  url: string;
  titulo: string | null;
  descricao: string | null;
  fonte_nome: string | null;
  categoria: string | null;
  data_publicacao: string | null;
  lista_imagens: string[] | null;
  imagem_refeita: string | null;
  status: string | null;
  is_duplicada: boolean | null;
  jornal_postado_at: string | null;
}

function shortDesc(raw: string | null | undefined): string | null {
  const text = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.slice(0, 320);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = (await req.json()) as RequestBody;
    const cidade_id = body?.cidade_id;
    const limit = Math.min(Math.max(body?.limit ?? LIMIT_DEFAULT, 1), LIMIT_MAX);

    if (!cidade_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "cidade_id obrigatorio" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .from("tabela_agente_buscador")
      .select("id, cidade_id, url, titulo, descricao, fonte_nome, categoria, data_publicacao, lista_imagens, imagem_refeita, status, is_duplicada, jornal_postado_at")
      .eq("cidade_id", cidade_id)
      .not("imagem_refeita", "is", null)
      .neq("status", "concluido")
      .is("jornal_postado_at", null)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (error) throw error;
    const rows = (data ?? []) as NoticiaRow[];

    if (!rows.length) {
      return new Response(
        JSON.stringify({
          ok: true,
          agente: "agente_publicador_05",
          cidade_id,
          total_entrada: 0,
          total_publicado: 0,
          total_ja_existia: 0,
          total_erros: 0,
          itens: [],
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const itens: Array<Record<string, unknown>> = [];
    let total_publicado = 0;
    let total_ja_existia = 0;
    let total_erros = 0;

    for (const n of rows) {
      try {
        const { data: existente, error: exErr } = await supabase
          .from("rel_cidade_jornal")
          .select("id")
          .eq("cidade_id", n.cidade_id)
          .eq("id_externo", n.url)
          .maybeSingle();
        if (exErr) throw exErr;

        if (existente?.id) {
          await supabase
            .from("tabela_agente_buscador")
            .update({
              status: "publicado",
              jornal_post_id: existente.id,
              jornal_postado_at: new Date().toISOString(),
              jornal_post_erro: null,
            })
            .eq("id", n.id);

          total_ja_existia++;
          itens.push({ id: n.id, ok: true, modo: "ja_existia", jornal_id: existente.id });
          continue;
        }

        const imagens = n.imagem_refeita
          ? [n.imagem_refeita, ...(n.lista_imagens ?? []).filter(Boolean).slice(0, 3)]
          : (n.lista_imagens ?? []).filter(Boolean).slice(0, 4);

        const payload = {
          cidade_id: n.cidade_id,
          titulo: (n.titulo ?? "").trim() || "Notícia",
          descricao: (n.descricao ?? "").trim() || "Sem descrição disponível.",
          data_noticia: n.data_publicacao || null,
          descricao_curta: shortDesc(n.descricao),
          fonte: n.fonte_nome || "Agente Buscador",
          categoria: n.categoria || "Geral",
          id_externo: n.url,
          imagens,
          ativo: true,
        };

        const { data: novoJornal, error: insErr } = await supabase
          .from("rel_cidade_jornal")
          .insert(payload)
          .select("id")
          .single();

        if (insErr) throw insErr;

        await supabase
          .from("tabela_agente_buscador")
          .update({
            status: "publicado",
            jornal_post_id: novoJornal.id,
            jornal_postado_at: new Date().toISOString(),
            jornal_post_erro: null,
          })
          .eq("id", n.id);

        total_publicado++;
        itens.push({ id: n.id, ok: true, modo: "publicado", jornal_id: novoJornal.id });
      } catch (e) {
        total_erros++;
        const msg = String(e);
        await supabase
          .from("tabela_agente_buscador")
          .update({ jornal_post_erro: msg.slice(0, 1000) })
          .eq("id", n.id);
        itens.push({ id: n.id, ok: false, erro: msg });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        agente: "agente_publicador_05",
        cidade_id,
        total_entrada: rows.length,
        total_publicado,
        total_ja_existia,
        total_erros,
        itens,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } },
    );
  }
});
