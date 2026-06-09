-- Logs do fluxo automatico de scraping de noticias V2.
-- O cron do pg_cron apenas enfileira o HTTP; esta tabela registra a execucao real.
CREATE TABLE IF NOT EXISTS public.cidade_scraping_auto_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id uuid REFERENCES public.cidade(id) ON DELETE SET NULL,
  request_id bigint,
  origem text NOT NULL DEFAULT 'edge',
  status text NOT NULL DEFAULT 'running',
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  duration_ms integer,
  steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cidade_scraping_auto_log_cidade_started
  ON public.cidade_scraping_auto_log (cidade_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_cidade_scraping_auto_log_request_id
  ON public.cidade_scraping_auto_log (request_id);

ALTER TABLE public.cidade_scraping_auto_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_auto_log'
      AND policyname = 'cidade_scraping_auto_log_select_authenticated'
  ) THEN
    CREATE POLICY cidade_scraping_auto_log_select_authenticated
      ON public.cidade_scraping_auto_log
      FOR SELECT TO authenticated
      USING (true);
  END IF;
END $$;

