import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const LIMIT_DEFAULT = 20;
const LIMIT_MAX = 30;
const MODEL_DEFAULT = "gpt-4o-mini";
const CONCURRENCY = 3;

interface RequestBody {
  cidade_id: string;
  limit?: number;
}

interface NoticiaInput {
  id: string;
  cidade_id: string;
  url: string;
  titulo: string | null;
  descricao: string | null;
  fonte_nome: string | null;
  status: "coletado" | "processando" | "processado" | "concluido" | "erro";
  created_at: string;
  titulo_original?: string | null;
  descricao_original?: string | null;
  jornal_postado_at?: string | null;
}

interface JornalRow {
  id: string;
  id_externo: string | null;
}

interface RewriteResult {
  titulo_reescrito: string;
  descricao_reescrita: string;
  texto_reescrito: string;
  categoria: string;
}

interface ProcessItem {
  id: string;
  ok: boolean;
  erro?: string;
  titulo_reescrito?: string;
}

function stripHtml(raw: string | null | undefined): string {
  const normalized = (raw ?? "").replace(/\r\n/g, "\n");
  const withBreaks = normalized
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p[^>]*>/gi, "\n\n")
    .replace(/<\/?(p|div|article|section|h[1-6]|li|ul|ol|blockquote)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const lines = withBreaks
    .split("\n")
    .map((line) => line.replace(/[ \t]{2,}/g, " ").trim());

  return lines
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function ensureTwoParagraphs(raw: string): string {
  const text = raw.replace(/\r\n/g, "\n").trim();
  if (!text) return text;

  if (/\n\s*\n/.test(text)) {
    return text.replace(/\n{3,}/g, "\n\n").trim();
  }

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length >= 4) {
    const mid = Math.ceil(sentences.length / 2);
    const p1 = sentences.slice(0, mid).join(" ").trim();
    const p2 = sentences.slice(mid).join(" ").trim();
    if (p1 && p2) return `${p1}\n\n${p2}`;
  }

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length >= 20) {
    const mid = Math.ceil(words.length / 2);
    return `${words.slice(0, mid).join(" ")}\n\n${words.slice(mid).join(" ")}`.trim();
  }

  return text;
}

function foldText(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function titleCase(raw: string): string {
  return raw
    .split(" ")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join(" ")
    .trim();
}

function normalizeCat(
  raw: string | null | undefined,
  fallbackText?: string | null
): string {
  const original = stripHtml(raw ?? "").replace(/\s{2,}/g, " ").trim();
  const t = foldText(original);
  const fallback = foldText(stripHtml(fallbackText ?? ""));

  const map: Array<{ re: RegExp; cat: string }> = [
    { re: /\b(camara municipal|vereador|legislativo)\b/, cat: "Câmara Municipal" },
    { re: /\b(politic|prefeit|senad|deputad|governad)\b/, cat: "Política" },
    { re: /\b(acidente|colisao|batida|capot|atropel|engavet)\b/, cat: "Acidente" },
    { re: /\b(transito|rodovia|br[- ]?\d+|estrada)\b/, cat: "Trânsito" },
    { re: /\b(tragedia|morte|morto|vitima fatal|desastre|afog|desab)\b/, cat: "Tragédia" },
    { re: /\b(polici|prisao|preso|crime|homicid|furto|roubo|trafico)\b/, cat: "Polícia" },
    { re: /\b(justica|stf|tj|mp|promotoria)\b/, cat: "Justiça" },
    { re: /\b(saude|hospital|medic|vacina|sus)\b/, cat: "Saúde" },
    { re: /\b(educa|escola|universidade|enem|aluno)\b/, cat: "Educação" },
    { re: /\b(econom|emprego|salario|imposto|comercio|empresa|negocio)\b/, cat: "Economia" },
    { re: /\b(obra|infraestrutura|pavimentacao|duplicacao)\b/, cat: "Infraestrutura" },
    { re: /\b(servico|atendimento|cadastro|beneficio)\b/, cat: "Serviços" },
  ];

  for (const m of map) {
    if (m.re.test(t)) return m.cat;
  }
  for (const m of map) {
    if (m.re.test(fallback)) return m.cat;
  }

  const normalizedOriginal = original
    .replace(/[^\p{L}\p{N}\s/-]/gu, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  if (normalizedOriginal && foldText(normalizedOriginal) !== "geral") {
    return titleCase(normalizedOriginal).slice(0, 50);
  }
  return "Cidade";
}

function limitTitleToTwoSentences(raw: string): string {
  const clean = stripHtml(raw).replace(/\s{2,}/g, " ").trim();
  if (!clean) return clean;

  const parts = clean
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const two = parts.slice(0, 2).join(" ").trim();
  const base = two || clean;
  if (base.length <= 190) return base;

  const cut = base.slice(0, 190);
  const lastSpace = cut.lastIndexOf(" ");
  return (lastSpace > 80 ? cut.slice(0, lastSpace) : cut).trim() + "...";
}

function buildPrompt(n: NoticiaInput): string {
  return `Você é o Agente de Texto 03, redator sênior de notícias, especialista em linguagem popular, títulos de alto impacto e voz do povo.

Sua tarefa é pegar a notícia abaixo (vinda do Agente Buscador) e reescrever com fidelidade total aos fatos, usando linguagem popular, humana, envolvente e fácil de ler.

OBJETIVO

Criar um título extremamente chamativo, no estilo de alguém contando uma notícia importante para outra pessoa.
O título precisa chamar atenção logo de cara, como em páginas populares do Instagram e portais de grande alcance, mas sem mentir, sem inventar e sem distorcer o fato.
O leitor deve entender o que aconteceu só pelo título, mesmo sem abrir a notícia.
O título deve contar quase toda a notícia de forma natural, emocional e direta.
O título pode ter no máximo 2 frases curtas.
Criar uma descrição fácil de ler em 2 parágrafos, com começo, meio e fim.
Na "descricao_reescrita", separar os 2 parágrafos com uma linha em branco ("\\n\\n").
Definir uma categoria específica, criativa e coerente com o assunto da notícia.
Nunca usar a categoria "Geral".

COMO O TÍTULO DEVE SOAR

O título deve parecer fala de gente de verdade.
Tem que soar como alguém reagindo e contando a notícia para outra pessoa.
Pode ter emoção, reação humana, surpresa, alerta, indignação, tristeza ou entusiasmo, desde que isso combine com o fato.

Exemplos de direção:
"Que tristeza!"
"Que absurdo!"
"Prepare o bolso:"
"Não acredito:"
"Pegou muita gente de surpresa:"
"Agora é oficial:"
"Isso chamou atenção:"
"Agora vai?"
"Fim de papo:"
"Vai mexer com muita gente:"
"Essa decisão deu o que falar:"
"Esse caso revoltou muita gente:"
"Tem alerta pra quem passa por..."
"Tem chance boa pra quem quer..."
"Essa notícia animou muita gente:"

IMPORTANTE:
Esses exemplos são apenas referências de tom.
Nunca transformar essas aberturas em modelo fixo.
Cada notícia pede um gancho diferente.
O agente deve criar aberturas novas, variadas e naturais, de acordo com o fato principal.

QUALIDADE DA ABERTURA DO TÍTULO

Antes de definir o título final, avalie se a abertura escolhida ficou genérica, previsível ou com cara de molde pronto.

Evite aberturas vagas e fáceis demais, como:
"Olha isso"
"Olha essa"
"Veja isso"
"Atenção"
"Imperdível"

Essas expressões só podem ser usadas se realmente encaixarem muito bem no fato.

Prefira aberturas que já transmitam emoção, contexto ou reação humana real, como:
"Que tristeza!"
"Que absurdo!"
"Prepare o bolso:"
"Pegou muita gente de surpresa:"
"Agora é oficial:"
"Essa decisão deu o que falar:"
"Vai mudar pra muita gente:"
"Tem alerta pra quem passa por..."
"Boa notícia pra quem quer..."

Se a abertura parecer genérica ou fraca, crie outra mais específica, mais humana e mais natural.
Se o começo do título puder servir para qualquer notícia, ele está fraco e deve ser refeito.

DIREÇÃO POR TIPO DE NOTÍCIA

- Tragédia / morte / acidente:
usar aberturas mais humanas e respeitosas, como "Que tristeza", "Muito triste", "Que tragédia", "Isso assustou muita gente"

- Política / Justiça / reviravolta:
usar aberturas como "Que absurdo", "Essa decisão deu o que falar", "Pegou muita gente de surpresa", "Não acredito"

- Dinheiro / cobrança / aumento / impacto financeiro:
usar aberturas como "Prepare o bolso", "Vai mexer no bolso", "Isso pesa no bolso", "Olha o gasto"

- Mudança de regra / serviço / cidade:
usar aberturas como "Atenção pra isso", "Agora é assim", "Essa mudança já está valendo", "Vai mudar pra muita gente"

- Oportunidade / curso / vaga / benefício:
usar aberturas como "Olha essa chance", "Tem oportunidade boa", "Essa chance pode mudar tudo", "Boa notícia pra quem quer"

- Obra / promessa / expectativa:
usar aberturas como "Agora vai?", "Depois de tanta espera", "Isso finalmente saiu", "Tem novidade nessa obra"

- Datas religiosas / históricas / curiosidades:
usar aberturas como "Muita gente nem lembra, mas...", "Pouca gente sabe, mas...", "Essa data chama atenção porque..."

REGRAS OBRIGATÓRIAS

Nunca inventar informação.
Nunca alterar nomes, números, datas, locais, cargos ou valores.
Nunca incluir opinião pessoal.
Nunca criar fatos ausentes no texto original.
Se faltar dado, não invente.
O título deve soar como alguém contando a notícia.
O título deve antecipar o máximo possível da informação principal.
Pode expressar emoção, mas sem sensacionalismo falso.
Não usar linguagem de jornal tradicional.
Não usar título frio, burocrático ou institucional.
Não usar frases artificiais que ninguém falaria na vida real.
Evitar estruturas prontas que deixem o título com cara de fórmula.

REGRAS PARA A DESCRIÇÃO

A descrição deve ser simples, direta e gostosa de ler.
Deve parecer que alguém está explicando a notícia de forma clara.
Pode ter leve tom humano e popular, mas sem exagerar.
Não transformar a notícia em reflexão motivacional.
Não inventar reação da população se isso não estiver no texto original.
Não dramatizar além do que o fato já mostra.
Não usar frases genéricas e repetidas como:
"muita gente não sabe"
"isso chama atenção"
"o que pouca gente entende é"
"isso nos faz pensar"
"é uma ótima notícia"
"esperamos que isso mude tudo"

Esse tipo de construção só pode aparecer se realmente encaixar no caso, e nunca de forma automática ou repetitiva.

CATEGORIA

A categoria deve ser específica, útil e coerente com o tema principal da notícia.
Nunca usar "Geral".
Sempre escolher a categoria mais adequada ao assunto.
Se estiver em dúvida, escolher a categoria mais específica possível com base no fato principal.

Exemplos de categorias possíveis:
- Acidente
- Tragédia
- Polícia
- Justiça
- Política
- Saúde
- Educação
- Trânsito
- Estradas
- Economia
- Empregos
- Oportunidade
- Obras
- Mobilidade
- Religião
- Cidade
- Direitos
- Negócios
- Serviços
- Infraestrutura
- Concurso
- Fiscalização
- Segurança
- Câmara Municipal
- Moradia
- Imigração

Se a notícia permitir, prefira categorias mais específicas do que amplas.

ESTILO

Português do Brasil.
Tom popular, humano e pessoal.
O texto deve parecer contado por alguém, não escrito por um jornal.
Frases simples, diretas e naturais.
Evitar linguagem robótica.
Use no máximo 1 emoji e apenas se fizer sentido com a emoção da notícia.
O emoji deve ser sutil e comum, sem exagero.

DIFERENÇA ENTRE OS CAMPOS

- "titulo_reescrito": título final, forte, humano, chamativo e fiel ao fato
- "descricao_reescrita": resumo em 2 parágrafos com linha em branco entre eles
- "texto_reescrito": repetir a descrição reescrita em versão corrida, sem quebra de parágrafo
- "categoria": categoria específica da notícia, nunca "Geral"

NOTÍCIA DE ENTRADA
ID: ${n.id}
URL: ${n.url}
FONTE: ${n.fonte_nome ?? ""}
TÍTULO ORIGINAL: ${stripHtml(n.titulo)}
DESCRIÇÃO ORIGINAL: ${stripHtml(n.descricao)}

Responda SOMENTE JSON válido no formato:
{
  "titulo_reescrito": "string",
  "descricao_reescrita": "string",
  "texto_reescrito": "string",
  "categoria": "string"
}`;
}
async function rewriteWithAI(
  n: NoticiaInput,
  apiKey: string,
  model: string
): Promise<RewriteResult> {
  const prompt = buildPrompt(n);
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      max_tokens: 900,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`OpenAI HTTP ${res.status}: ${txt.slice(0, 800)}`);
  }

  const data = await res.json();
  const text: string = data?.choices?.[0]?.message?.content ?? "";
  if (!text) throw new Error("OpenAI sem conteÃºdo");

  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Falha ao parsear JSON da IA");
    parsed = JSON.parse(m[0]);
  }

  const titulo = limitTitleToTwoSentences(stripHtml(parsed?.titulo_reescrito));
  const descricao = ensureTwoParagraphs(stripHtml(parsed?.descricao_reescrita));
  const texto = stripHtml(parsed?.texto_reescrito);
  const categoria = normalizeCat(
    parsed?.categoria,
    `${n.titulo ?? ""}\n${n.descricao ?? ""}`
  );

  if (!titulo || !descricao || !texto) {
    throw new Error("Resposta da IA incompleta");
  }

  return {
    titulo_reescrito: titulo,
    descricao_reescrita: descricao,
    texto_reescrito: texto,
    categoria,
  };
}

async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let i = 0;

  async function worker() {
    while (i < tasks.length) {
      const idx = i++;
      try {
        results[idx] = { status: "fulfilled", value: await tasks[idx]() };
      } catch (reason) {
        results[idx] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = (await req.json()) as RequestBody;
    const cidade_id = body?.cidade_id;
    const limit = Math.min(Math.max(body?.limit ?? LIMIT_DEFAULT, 1), LIMIT_MAX);

    if (!cidade_id) {
      return new Response(
        JSON.stringify({ ok: false, error: "cidade_id obrigatorio" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const openaiKey = Deno.env.get("OPENAI_API_KEY") ?? "";
    if (!openaiKey) {
      return new Response(
        JSON.stringify({ ok: false, error: "OPENAI_API_KEY ausente nos secrets" }),
        { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }
    const model = Deno.env.get("AGENTE_TEXTO_03_MODEL") ?? MODEL_DEFAULT;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data, error } = await supabase
      .from("tabela_agente_buscador")
      .select("id, cidade_id, url, titulo, descricao, fonte_nome, status, created_at, titulo_original, descricao_original, is_duplicada, jornal_postado_at")
      .eq("cidade_id", cidade_id)
      .eq("is_duplicada", false)
      .is("jornal_postado_at", null)
      .in("status", ["coletado", "erro"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw error;

    const noticiasBase = (data ?? []) as NoticiaInput[];

    // Guarda extra: se a URL já estiver no jornal da cidade, não reescreve novamente.
    // Isso cobre casos antigos em que o status na tabela de scraping ficou desatualizado.
    const urls = noticiasBase
      .map((n) => (n.url ?? "").trim())
      .filter((u) => !!u);

    let publicadasPorUrl = new Map<string, string>();
    if (urls.length) {
      const { data: jornalRows, error: jornalErr } = await supabase
        .from("rel_cidade_jornal")
        .select("id, id_externo")
        .eq("cidade_id", cidade_id)
        .in("id_externo", urls);
      if (jornalErr) throw jornalErr;

      for (const row of ((jornalRows ?? []) as JornalRow[])) {
        const key = (row.id_externo ?? "").trim();
        if (key) publicadasPorUrl.set(key, row.id);
      }
    }

    const noticiasJaPublicadas = noticiasBase.filter((n) =>
      publicadasPorUrl.has((n.url ?? "").trim())
    );
    const noticias = noticiasBase.filter((n) =>
      !publicadasPorUrl.has((n.url ?? "").trim())
    );

    if (noticiasJaPublicadas.length) {
      await supabase
        .from("tabela_agente_buscador")
        .update({
          status: "publicado",
          jornal_postado_at: new Date().toISOString(),
          jornal_post_erro: null,
        })
        .in("id", noticiasJaPublicadas.map((n) => n.id));
    }

    if (!noticias.length) {
      return new Response(
        JSON.stringify({
          ok: true,
          agente: "agente_texto_03",
          cidade_id,
          total_entrada: noticiasBase.length,
          total_processado: 0,
          total_ja_publicadas: noticiasJaPublicadas.length,
          itens: [],
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Marca lote como processando
    await supabase
      .from("tabela_agente_buscador")
      .update({ status: "processando" })
      .in("id", noticias.map((n) => n.id));

    const items: ProcessItem[] = [];
    const tasks = noticias.map((n) => async () => {
      const rewritten = await rewriteWithAI(n, openaiKey, model);

      const payload = {
        titulo_original: n.titulo_original ?? n.titulo,
        descricao_original: n.descricao_original ?? n.descricao,
        titulo_reescrito: rewritten.titulo_reescrito,
        descricao_reescrita: rewritten.descricao_reescrita,
        texto_reescrito: rewritten.texto_reescrito,
        categoria: rewritten.categoria,
        // Atualiza os campos principais para o app jÃ¡ consumir a versÃ£o nova
        titulo: rewritten.titulo_reescrito,
        descricao: rewritten.descricao_reescrita,
        status: "processado",
        agente_texto_updated_at: new Date().toISOString(),
      };

      const { error: updErr } = await supabase
        .from("tabela_agente_buscador")
        .update(payload)
        .eq("id", n.id);

      if (updErr) throw new Error(`Update ${n.id}: ${updErr.message}`);

      const result: ProcessItem = {
        id: n.id,
        ok: true,
        titulo_reescrito: rewritten.titulo_reescrito,
      };
      items.push(result);
      return result;
    });

    const settled = await runConcurrent(tasks, CONCURRENCY);

    for (let i = 0; i < settled.length; i++) {
      const r = settled[i];
      if (r.status === "rejected") {
        const n = noticias[i];
        const errMsg = String(r.reason);
        items.push({ id: n.id, ok: false, erro: errMsg });
        await supabase
          .from("tabela_agente_buscador")
          .update({ status: "erro" })
          .eq("id", n.id);
      }
    }

    const total_processado = items.filter((i) => i.ok).length;
    const total_erros = items.length - total_processado;

    return new Response(
      JSON.stringify({
        ok: true,
        agente: "agente_texto_03",
        cidade_id,
        model,
        total_entrada: noticiasBase.length,
        total_elegiveis: noticias.length,
        total_ja_publicadas: noticiasJaPublicadas.length,
        total_processado,
        total_erros,
        itens: items,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});
