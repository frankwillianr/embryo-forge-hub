import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIMIT_DEFAULT = 120;
const LIMIT_MAX = 500;

interface RequestBody {
  cidade_id: string;
  limit?: number;
}

interface VagaScraping {
  id: string;
  cidade_id: string;
  titulo: string | null;
  empresa: string | null;
  descricao: string | null;
  area: string | null;
  tipo_contrato: string | null;
  salario: string | null;
  local_vaga: string | null;
  contato: string | null;
  fonte_nome: string | null;
  url_origem: string | null;
  created_at: string;
  status_fluxo: string | null;
  publicado_em_vagas: boolean | null;
}

const clean = (v: string | null | undefined) => (v ?? "").trim();

const norm = (v: string | null | undefined) =>
  clean(v)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const mapTipoContrato = (tipo: string | null | undefined, descricao: string | null | undefined) => {
  const t = `${norm(tipo)} ${norm(descricao)}`;
  if (/\bpj\b|pessoa juridica/.test(t)) return "pj";
  if (/estagio|estagiario/.test(t)) return "estagio";
  if (/freelance|freela|autonom/.test(t)) return "freelancer";
  if (/temporario|temporaria/.test(t)) return "temporario";
  return "clt";
};

const mapModalidade = (local: string | null | undefined, descricao: string | null | undefined) => {
  const t = `${norm(local)} ${norm(descricao)}`;
  if (/hibrid/.test(t)) return "hibrido";
  if (/remot|home office/.test(t)) return "remoto";
  return "presencial";
};

const extractEmail = (raw: string | null | undefined): string | null => {
  const m = clean(raw).match(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/);
  return m ? m[0].toLowerCase() : null;
};

const extractWhatsAppOrPhone = (raw: string | null | undefined): string | null => {
  const txt = clean(raw);
  if (!txt) return null;
  const wa = txt.match(/wa\.me\/(\d{10,15})/i);
  if (wa) return wa[1];
  const ph = txt.match(/(?:\+?55[\s-]?)?(?:\(?\d{2}\)?[\s.-]?)(?:9\d{4}|\d{4})[\s.-]?\d{4}/);
  if (!ph) return null;
  const digits = ph[0].replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits;
};

const normalizeSalario = (raw: string | null | undefined): string | null => {
  const cleaned = clean(raw).replace(/[;.,]+$/g, "").trim();
  if (!cleaned) return null;
  const withCurrency = cleaned.match(/R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i);
  if (withCurrency) return `R$ ${withCurrency[1]}`;
  const withoutCurrency = cleaned.match(/\b(\d{1,3}(?:\.\d{3})*,\d{2})\b/);
  if (withoutCurrency) return `R$ ${withoutCurrency[1]}`;
  return null;
};

const extractSalarioFromText = (raw: string | null | undefined): string | null => {
  const txt = clean(raw);
  if (!txt) return null;
  const withCurrency = txt.match(/R\$\s*\d{1,3}(?:\.\d{3})*,\d{2}/i);
  if (withCurrency) return normalizeSalario(withCurrency[0]);
  const labeled = txt.match(/sal[aá]rio[^:\n]{0,20}[:\-\s]+([^\n]{2,120})/i);
  if (labeled) return normalizeSalario(labeled[1]);
  const withoutCurrency = txt.match(/\b\d{1,3}(?:\.\d{3})*,\d{2}\b/);
  if (withoutCurrency) return normalizeSalario(withoutCurrency[0]);
  return null;
};

const LISTING_URL_PATTERNS = [
  /\/empregos-em-/i,
  /\/vagas-em-/i,
  /\/l-[^/]+-vagas\.html/i,
  /\/search[/?]/i,
  /\/busca[/?]/i,
  /[?&]page=/i,
  /[?&]pagina=/i,
];

const isInvalidSourceUrl = (url: string | null | undefined) => {
  const u = clean(url);
  if (!u) return true;
  if (!/^https?:\/\//i.test(u)) return true;
  return LISTING_URL_PATTERNS.some((re) => re.test(u));
};

const dedupeKeyFromScraping = (v: VagaScraping) =>
  `${norm(v.titulo)}|${norm(v.empresa)}|${norm((v.descricao ?? "").slice(0, 180))}`;

const dedupeKeyFromVagas = (v: { titulo: string | null; empresa: string | null; descricao: string | null }) =>
  `${norm(v.titulo)}|${norm(v.empresa)}|${norm((v.descricao ?? "").slice(0, 180))}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  try {
    const body = (await req.json()) as RequestBody;
    const cidade_id = clean(body?.cidade_id);
    const limit = Math.min(Math.max(body?.limit ?? LIMIT_DEFAULT, 1), LIMIT_MAX);

    if (!cidade_id) {
      return new Response(JSON.stringify({ ok: false, error: "cidade_id obrigatorio" }), {
        status: 400,
        headers: { ...CORS, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: scrapingRows, error: scrapingErr } = await supabase
      .from("vagas_emprego_scraping")
      .select("id, cidade_id, titulo, empresa, descricao, area, tipo_contrato, salario, local_vaga, contato, fonte_nome, url_origem, created_at, status_fluxo, publicado_em_vagas")
      .eq("cidade_id", cidade_id)
      .eq("publicado_em_vagas", false)
      .in("status_fluxo", ["coletada", "resumida"])
      .order("created_at", { ascending: false })
      .limit(limit);

    if (scrapingErr) throw scrapingErr;
    const rows = (scrapingRows ?? []) as VagaScraping[];

    if (!rows.length) {
      return new Response(
        JSON.stringify({
          ok: true,
          agente: "agente_emprego_publicador_03",
          cidade_id,
          total_origem: 0,
          inseridas: 0,
          ignoradas_duplicadas: 0,
          ignoradas_invalidas: 0,
        }),
        { headers: { ...CORS, "Content-Type": "application/json" } },
      );
    }

    const { data: existingRows, error: existingErr } = await supabase
      .from("vagas")
      .select("id, titulo, empresa, descricao")
      .eq("cidade_id", cidade_id)
      .order("created_at", { ascending: false })
      .limit(3000);

    if (existingErr) throw existingErr;
    const existing = new Set((existingRows ?? []).map((r) => dedupeKeyFromVagas(r)));

    const toInsert: Array<{ sourceId: string; payload: Record<string, unknown> }> = [];
    const idsParaConcluir: string[] = [];
    const idsParaInvalidar: string[] = [];
    let ignoredDuplicated = 0;
    let ignoredInvalid = 0;

    for (const row of rows) {
      const titulo = clean(row.titulo);
      const empresa = clean(row.empresa);
      const descricao = clean(row.descricao);
      if (!titulo) {
        ignoredInvalid++;
        idsParaInvalidar.push(row.id);
        continue;
      }
      if (!empresa || !descricao) {
        ignoredInvalid++;
        idsParaInvalidar.push(row.id);
        continue;
      }
      if (isInvalidSourceUrl(row.url_origem)) {
        ignoredInvalid++;
        idsParaInvalidar.push(row.id);
        continue;
      }

      const key = dedupeKeyFromScraping(row);
      if (existing.has(key)) {
        ignoredDuplicated++;
        idsParaConcluir.push(row.id);
        continue;
      }

      const requisitos = row.area ? `Area: ${clean(row.area)}` : null;

      const item = {
        cidade_id,
        titulo,
        empresa,
        descricao,
        requisitos,
        salario: normalizeSalario(row.salario) ?? extractSalarioFromText(row.descricao),
        tipo_contrato: mapTipoContrato(row.tipo_contrato, row.descricao),
        modalidade: mapModalidade(row.local_vaga, row.descricao),
        contato_whatsapp: extractWhatsAppOrPhone(row.contato),
        contato_email: extractEmail(row.contato),
        ativo: true,
      };

      toInsert.push({ sourceId: row.id, payload: item });
      existing.add(key);
    }

    if (toInsert.length > 0) {
      for (let i = 0; i < toInsert.length; i += 100) {
        const chunk = toInsert.slice(i, i + 100);
        const { error: insErr } = await supabase.from("vagas").insert(chunk.map((c) => c.payload));
        if (insErr) throw insErr;
        idsParaConcluir.push(...chunk.map((c) => c.sourceId));
      }
    }

    if (idsParaConcluir.length > 0) {
      const { error: updErr } = await supabase
        .from("vagas_emprego_scraping")
        .update({
          publicado_em_vagas: true,
          publicado_em_vagas_at: new Date().toISOString(),
          status_fluxo: "concluida",
        })
        .in("id", idsParaConcluir);
      if (updErr) throw updErr;
    }

    if (idsParaInvalidar.length > 0) {
      const { error: invalidErr } = await supabase
        .from("vagas_emprego_scraping")
        .update({
          status_fluxo: "invalidada",
        })
        .in("id", idsParaInvalidar);
      if (invalidErr) throw invalidErr;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        agente: "agente_emprego_publicador_03",
        cidade_id,
        total_origem: rows.length,
        inseridas: toInsert.length,
        concluidas: idsParaConcluir.length,
        invalidadas: idsParaInvalidar.length,
        ignoradas_duplicadas: ignoredDuplicated,
        ignoradas_invalidas: ignoredInvalid,
      }),
      { headers: { ...CORS, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      }),
      {
        status: 500,
        headers: { ...CORS, "Content-Type": "application/json" },
      },
    );
  }
});
