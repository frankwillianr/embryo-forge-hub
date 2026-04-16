-- Busca automatica de cinema
-- Regra: se cinema_auto_ativo = true para a cidade, roda diariamente as 07:00 e 10:00 (America/Sao_Paulo)
-- Em UTC (BRT): 10:00 e 13:00 -> cron "0 10 * * *" e "0 13 * * *"

ALTER TABLE public.cidade_scraping_config
  ADD COLUMN IF NOT EXISTS cinema_auto_ativo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cidade_scraping_config_cinema_auto_ativo
  ON public.cidade_scraping_config (cinema_auto_ativo);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.run_auto_scraping_cinema_cidades()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT cidade_id, COALESCE(max_artigos, 60) AS max_filmes, COALESCE(lookback_dias, 14) AS lookback_dias
    FROM public.cidade_scraping_config
    WHERE cinema_auto_ativo = true
  LOOP
    PERFORM net.http_post(
      url := 'https://umauozcntfxgphzbiifz.supabase.co/functions/v1/agente_cinema_buscador_01',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g',
        'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g'
      ),
      body := jsonb_build_object(
        'cidade_id', rec.cidade_id,
        'max_filmes', rec.max_filmes,
        'lookback_dias', rec.lookback_dias
      ),
      timeout_milliseconds := 600000
    );
  END LOOP;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN (
    'agente-cinema-auto-07-brt',
    'agente-cinema-auto-10-brt'
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'agente-cinema-auto-07-brt',
  '0 10 * * *',
  $$SELECT public.run_auto_scraping_cinema_cidades();$$
);

SELECT cron.schedule(
  'agente-cinema-auto-10-brt',
  '0 13 * * *',
  $$SELECT public.run_auto_scraping_cinema_cidades();$$
);
