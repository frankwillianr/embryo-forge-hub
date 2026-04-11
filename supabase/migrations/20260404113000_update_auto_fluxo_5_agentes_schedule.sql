-- Atualiza fluxo automatico para pipeline V2 (Agentes 1 > 2 > 3 > 4 > 5)
-- Horarios: 08h, 12h, 16h e 21h (America/Sao_Paulo)
-- Em UTC: 11h, 15h, 19h e 00h

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.run_auto_scraping_cidades()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT cidade_id
    FROM public.cidade_scraping_config
    WHERE auto_ativo = true
  LOOP
    PERFORM net.http_post(
      url := 'https://umauozcntfxgphzbiifz.supabase.co/functions/v1/agente_fluxo_automatico_v2',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g',
        'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g'
      ),
      body := jsonb_build_object(
        'cidade_id', rec.cidade_id
      ),
      timeout_milliseconds := 300000
    );
  END LOOP;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN (
    'coletar-noticias-gv-auto-3h',
    'agentes-v2-auto-08-12-16-21-brt'
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'agentes-v2-auto-08-12-16-21-brt',
  '0 0,11,15,19 * * *',
  $$SELECT public.run_auto_scraping_cidades();$$
);
