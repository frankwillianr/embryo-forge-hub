-- Configuracao de scraping automatico por cidade
CREATE TABLE IF NOT EXISTS cidade_scraping_config (
  cidade_id uuid PRIMARY KEY REFERENCES cidade(id) ON DELETE CASCADE,
  auto_ativo boolean NOT NULL DEFAULT false,
  intervalo_horas integer NOT NULL DEFAULT 3 CHECK (intervalo_horas = 3),
  lookback_dias integer NOT NULL DEFAULT 2 CHECK (lookback_dias BETWEEN 1 AND 30),
  max_artigos integer NOT NULL DEFAULT 60 CHECK (max_artigos BETWEEN 10 AND 120),
  rewrite_ai boolean NOT NULL DEFAULT true,
  validate_ai boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE cidade_scraping_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_config'
      AND policyname = 'cidade_scraping_config_select_authenticated'
  ) THEN
    CREATE POLICY cidade_scraping_config_select_authenticated
      ON cidade_scraping_config
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_config'
      AND policyname = 'cidade_scraping_config_insert_authenticated'
  ) THEN
    CREATE POLICY cidade_scraping_config_insert_authenticated
      ON cidade_scraping_config
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_config'
      AND policyname = 'cidade_scraping_config_update_authenticated'
  ) THEN
    CREATE POLICY cidade_scraping_config_update_authenticated
      ON cidade_scraping_config
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION update_cidade_scraping_config_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cidade_scraping_config_updated_at ON cidade_scraping_config;
CREATE TRIGGER trg_cidade_scraping_config_updated_at
BEFORE UPDATE ON cidade_scraping_config
FOR EACH ROW
EXECUTE FUNCTION update_cidade_scraping_config_updated_at();

-- Seed da cidade de Governador Valadares (idempotente)
INSERT INTO cidade_scraping_config (
  cidade_id,
  auto_ativo,
  intervalo_horas,
  lookback_dias,
  max_artigos,
  rewrite_ai,
  validate_ai
)
VALUES (
  '2bafc0da-6960-403b-b25b-79f72066775a',
  false,
  3,
  2,
  60,
  true,
  true
)
ON CONFLICT (cidade_id) DO NOTHING;

-- Funcao executada pelo cron a cada 3 horas.
CREATE OR REPLACE FUNCTION run_auto_scraping_cidades()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT cidade_id, lookback_dias, max_artigos, rewrite_ai, validate_ai
    FROM cidade_scraping_config
    WHERE auto_ativo = true
  LOOP
    PERFORM net.http_post(
      url := 'https://umauozcntfxgphzbiifz.supabase.co/functions/v1/coletar-noticias-gv',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g'
      ),
      body := jsonb_build_object(
        'cidade_id', rec.cidade_id,
        'stream', false,
        'test_mode', false,
        'auto_mode', true,
        'lookback_days', rec.lookback_dias,
        'max_articles', rec.max_artigos,
        'rewrite_ai', rec.rewrite_ai,
        'validate_ai', rec.validate_ai
      ),
      timeout_milliseconds := 180000
    );
  END LOOP;
END;
$$;

-- Troca agendamentos antigos por um job unico a cada 3 horas.
DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN (
    'coletar-noticias-gv-11h',
    'coletar-noticias-gv-14h',
    'coletar-noticias-gv-17h',
    'coletar-noticias-gv-22h',
    'coletar-noticias-gv-auto-3h'
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'coletar-noticias-gv-auto-3h',
  '0 */3 * * *',
  $$SELECT run_auto_scraping_cidades();$$
);
