CREATE TABLE IF NOT EXISTS public.vagas_emprego_scraping (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id     UUID NOT NULL REFERENCES public.cidade(id) ON DELETE CASCADE,
  titulo        TEXT NOT NULL,
  empresa       TEXT,
  descricao     TEXT,
  area          TEXT,
  tipo_contrato TEXT,
  salario       TEXT,
  local_vaga    TEXT,
  url_origem    TEXT,
  fonte_nome    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vagas_emprego_scraping_cidade
  ON public.vagas_emprego_scraping (cidade_id);

CREATE INDEX IF NOT EXISTS idx_vagas_emprego_scraping_cidade_created
  ON public.vagas_emprego_scraping (cidade_id, created_at DESC);

ALTER TABLE public.vagas_emprego_scraping ENABLE ROW LEVEL SECURITY;

CREATE POLICY vagas_emprego_scraping_select
  ON public.vagas_emprego_scraping FOR SELECT TO authenticated USING (true);

CREATE POLICY vagas_emprego_scraping_insert
  ON public.vagas_emprego_scraping FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY vagas_emprego_scraping_update
  ON public.vagas_emprego_scraping FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY vagas_emprego_scraping_delete
  ON public.vagas_emprego_scraping FOR DELETE TO authenticated USING (true);
