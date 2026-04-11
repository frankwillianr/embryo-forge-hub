-- Publicacao automatica de vagas de emprego
-- Regra: se emprego_auto_ativo = true para a cidade, roda diariamente as 18:00 (America/Sao_Paulo)
-- Em UTC (BRT): 21:00 -> cron "0 21 * * *"

ALTER TABLE public.cidade_scraping_config
  ADD COLUMN IF NOT EXISTS emprego_auto_ativo boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cidade_scraping_config_emprego_auto_ativo
  ON public.cidade_scraping_config (emprego_auto_ativo);

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.run_auto_scraping_emprego_cidades()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT cidade_id, COALESCE(max_artigos, 60) AS max_vagas, COALESCE(lookback_dias, 14) AS lookback_dias
    FROM public.cidade_scraping_config
    WHERE emprego_auto_ativo = true
  LOOP
    PERFORM net.http_post(
      url := 'https://umauozcntfxgphzbiifz.supabase.co/functions/v1/agente_fluxo_automatico_emprego_v1',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g',
        'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g'
      ),
      body := jsonb_build_object(
        'cidade_id', rec.cidade_id,
        'max_vagas', rec.max_vagas,
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
  WHERE jobname = 'agentes-emprego-auto-18-brt';
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'agentes-emprego-auto-18-brt',
  '0 21 * * *',
  $$SELECT public.run_auto_scraping_emprego_cidades();$$
);

