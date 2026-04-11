ALTER TABLE public.vagas_emprego_scraping
  ADD COLUMN IF NOT EXISTS processado_texto_02 BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS texto_02_processado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publicado_em_vagas BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS publicado_em_vagas_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status_fluxo TEXT NOT NULL DEFAULT 'coletada';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'vagas_emprego_scraping_status_fluxo_chk'
  ) THEN
    ALTER TABLE public.vagas_emprego_scraping
      ADD CONSTRAINT vagas_emprego_scraping_status_fluxo_chk
      CHECK (status_fluxo IN ('coletada', 'resumida', 'concluida'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_vagas_emprego_scraping_status_fluxo
  ON public.vagas_emprego_scraping (cidade_id, status_fluxo);

CREATE INDEX IF NOT EXISTS idx_vagas_emprego_scraping_publicado
  ON public.vagas_emprego_scraping (cidade_id, publicado_em_vagas);

