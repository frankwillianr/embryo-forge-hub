import Jimp from "npm:jimp@0.22.12";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { Buffer } from "node:buffer";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface RequestBody {
  cidade_id: string;
}

interface NoticiaRow {
  id: string;
  cidade_id: string;
  titulo: string | null;
  categoria: string | null;
  lista_imagens: string[] | null;
  imagem_refeita: string | null;
  is_duplicada: boolean | null;
  status: string | null;
  created_at: string;
}

const BUCKET_DEFAULT = "jornal-imagens";
const GVCITY_LOGO_URL =
  "https://umauozcntfxgphzbiifz.supabase.co/storage/v1/object/public/jornal-imagens/logos/gvcity-logo.png";

// Dimensões fixas do card
const CARD_W = 1024;
const CARD_H = 1024;
const PAD = 28;
const LOGO_SIZE = 52;
const LOGO_X = PAD;
const LOGO_Y = 14;
const HEADER_H = LOGO_Y + LOGO_SIZE + 16; // ~82px
const TITLE_Y = HEADER_H + 16;            // ~98px
const TITLE_MAX_H = 196;                   // espaço levemente maior para título
const IMAGE_Y = TITLE_Y + TITLE_MAX_H;    // ~278px â†’ foto preenche o resto
const TITLE_TARGET_SIZE = 45;
const CAT_TARGET_SIZE = 20;

async function fetchBuffer(url: string): Promise<Buffer> {
  const res = await fetch(url, { headers: { "User-Agent": "agente_imagem_04/1.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

function safeTitle(raw: string | null | undefined): string {
  return (raw ?? "").replace(/\s{2,}/g, " ").trim().slice(0, 220);
}

function firstImageCandidates(firstUrl: string): string[] {
  const out = [firstUrl];

  // Tentativa comum: *.jpg.webp -> *.jpg
  if (/\.webp(\?|$)/i.test(firstUrl)) {
    out.push(firstUrl.replace(/\.webp(\?|$)/i, "$1"));
  }

  // Tentativa comum do plugin WebP Express (WordPress)
  if (/\/webp-express\/webp-images\//i.test(firstUrl)) {
    out.push(firstUrl.replace(/\/webp-express\/webp-images\//i, "/"));
  }

  // Combinação das duas regras
  if (/\/webp-express\/webp-images\//i.test(firstUrl) && /\.webp(\?|$)/i.test(firstUrl)) {
    out.push(
      firstUrl
        .replace(/\/webp-express\/webp-images\//i, "/")
        .replace(/\.webp(\?|$)/i, "$1"),
    );
  }

  // Fallback universal: proxy que converte imagem remota para JPG/PNG.
  // Mantém a MESMA primeira imagem, apenas muda a forma de servir o arquivo.
  try {
    const clean = firstUrl.trim();
    const noProto = clean.replace(/^https?:\/\//i, "");
    out.push(`https://images.weserv.nl/?url=${encodeURIComponent(noProto)}&output=jpg`);
    out.push(`https://images.weserv.nl/?url=${encodeURIComponent(noProto)}&output=png`);
  } catch {
    // ignora
  }

  return [...new Set(out)];
}

async function buildCard(
  logoBuf: Buffer,
  newsBuf: Buffer,
  title: string,
  categoria: string,
): Promise<Buffer> {
  // ── 1. Card base branco ───────────────────────────────────────────────────
  const card = new Jimp(CARD_W, CARD_H, 0xffffffff);

  // ── 2. Foto da notícia (cobre a área abaixo do header+título) ─────────────
  const newsImg = await Jimp.read(newsBuf);
  const imgAreaH = CARD_H - IMAGE_Y;
  newsImg.cover(CARD_W, imgAreaH);
  card.composite(newsImg, 0, IMAGE_Y);

  // ── 3. Logo circular ──────────────────────────────────────────────────────
  const logoImg = await Jimp.read(logoBuf);
  logoImg.resize(LOGO_SIZE, LOGO_SIZE);

  const cx = LOGO_SIZE / 2;
  const cy = LOGO_SIZE / 2;
  const r2 = (LOGO_SIZE / 2) * (LOGO_SIZE / 2);

  for (let py = 0; py < LOGO_SIZE; py++) {
    for (let px = 0; px < LOGO_SIZE; px++) {
      const dx = px - cx, dy = py - cy;
      if (dx * dx + dy * dy <= r2) {
        const color = logoImg.getPixelColor(px, py);
        card.setPixelColor(color, LOGO_X + px, LOGO_Y + py);
      }
    }
  }

  // ── 4. Linha divisória ────────────────────────────────────────────────────
  const dividerColor = 0xE0E0E0FF;
  for (let x = 0; x < CARD_W; x++) {
    card.setPixelColor(dividerColor, x, HEADER_H);
  }

  // ── 5. Categoria em negrito ───────────────────────────────────────────────
  const catFont = await Jimp.loadFont(Jimp.FONT_SANS_32_BLACK);
  const catLabel = (categoria || "Geral").toUpperCase();
  const catX = LOGO_X + LOGO_SIZE + 14;
  const catY = LOGO_Y + Math.floor((LOGO_SIZE - CAT_TARGET_SIZE) / 2);
  const catScale = CAT_TARGET_SIZE / 32;
  const catHiW = Math.max(1, Math.round((CARD_W - catX - PAD) / catScale));
  const catHiH = Math.max(1, Math.round(Math.max(CAT_TARGET_SIZE + 8, 32) / catScale));
  const catLayer = new Jimp(catHiW, catHiH, 0x00000000);
  catLayer.print(catFont, 0, 0, catLabel);
  const catW = Math.max(1, Math.round(catHiW * catScale));
  const catH = Math.max(1, Math.round(catHiH * catScale));
  catLayer.resize(catW, catH, Jimp.RESIZE_BICUBIC);
  card.composite(catLayer, catX, catY);
  card.composite(catLayer, catX + 1, catY); // leve reforço de peso

  // ── 6. Título ─────────────────────────────────────────────────────────────
  const titleFont = await Jimp.loadFont(Jimp.FONT_SANS_64_BLACK);
  const titleBoxW = CARD_W - PAD * 2;
  const scale = TITLE_TARGET_SIZE / 64;
  const hiW = Math.max(1, Math.round(titleBoxW / scale));
  const hiH = Math.max(1, Math.round(TITLE_MAX_H / scale));
  const titleLayer = new Jimp(hiW, hiH, 0x00000000);
  const titleCfg = { text: title, alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT };
  titleLayer.print(titleFont, 0, 0, titleCfg, hiW, hiH);
  titleLayer.resize(titleBoxW, TITLE_MAX_H, Jimp.RESIZE_BICUBIC);
  card.composite(titleLayer, PAD, TITLE_Y);

  return card.getBufferAsync(Jimp.MIME_PNG);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = (await req.json().catch(() => ({}))) as Partial<RequestBody>;
    const cidade_id = body?.cidade_id;

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
    const bucket = Deno.env.get("AGENTE_IMAGEM_04_BUCKET") ?? BUCKET_DEFAULT;

    const { data, error } = await supabase
      .from("tabela_agente_buscador")
      .select("id, cidade_id, titulo, categoria, lista_imagens, imagem_refeita, is_duplicada, status, created_at")
      .eq("cidade_id", cidade_id)
      .eq("is_duplicada", false)
      .neq("status", "concluido")
      .neq("status", "publicado")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) throw error;

    const noticias = ((data ?? []) as NoticiaRow[]).filter(
      (n) => !n.imagem_refeita && (n.lista_imagens?.length ?? 0) > 0,
    );

    if (!noticias.length) {
      return new Response(
        JSON.stringify({
          ok: true,
          agente: "agente_imagem_04",
          cidade_id,
          total_entrada: 0,
          total_processado: 0,
          message: "Nenhuma notícia elegível para gerar imagem.",
          itens: [],
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    // ── Busca logo + primeira notícia (usando sempre a 1ª imagem da lista) ──
    const logoBuf = await fetchBuffer(GVCITY_LOGO_URL);

    const itens: Array<Record<string, unknown>> = [];
    let total_processado = 0;
    let total_erros = 0;

    for (const noticia of noticias) {
      try {
        const origem = noticia.lista_imagens?.[0] ?? "";
        if (!origem) {
          throw new Error("A noticia selecionada nao possui primeira imagem");
        }

        // Regra solicitada: usar sempre a primeira imagem da noticia.
        // Se vier em WebP, tenta variacoes equivalentes do MESMO link para obter JPG/PNG.
        let newsBuf: Buffer | null = null;
        let origemUsada = origem;
        let lastErr = "";
        for (const candidate of firstImageCandidates(origem)) {
          try {
            const buf = await fetchBuffer(candidate);
            await Jimp.read(buf);
            newsBuf = buf;
            origemUsada = candidate;
            break;
          } catch (e) {
            lastErr = String(e);
          }
        }
        if (!newsBuf) {
          throw new Error(`Nao foi possivel usar a primeira imagem da noticia: ${lastErr}`);
        }

        const title = safeTitle(noticia.titulo);
        const categoria = noticia.categoria ?? "Geral";
        const pngBuffer = await buildCard(logoBuf, newsBuf, title, categoria);

        const filePath = `agente-imagem-04/${cidade_id}/${noticia.id}-${Date.now()}.png`;
        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(filePath, pngBuffer, { contentType: "image/png", upsert: true });
        if (upErr) throw new Error(`Upload falhou: ${upErr.message}`);

        const { data: pub } = supabase.storage.from(bucket).getPublicUrl(filePath);
        const imagem_refeita = pub?.publicUrl;
        if (!imagem_refeita) throw new Error("URL publica nao gerada");

        const { error: updErr } = await supabase
          .from("tabela_agente_buscador")
          .update({
            imagem_refeita,
            status: "processado",
            agente_imagem_updated_at: new Date().toISOString(),
          })
          .eq("id", noticia.id);
        if (updErr) throw new Error(`Update falhou: ${updErr.message}`);

        total_processado++;
        itens.push({ id: noticia.id, ok: true, imagem_origem: origemUsada, imagem_refeita });
      } catch (e) {
        total_erros++;
        itens.push({ id: noticia.id, ok: false, erro: String(e) });
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        agente: "agente_imagem_04",
        cidade_id,
        total_entrada: noticias.length,
        total_processado,
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


