-- Rede de seguranca para o Jornal: publica noticias ja processadas mesmo
-- quando o fluxo completo de agentes estoura timeout antes do Agente 5.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.run_auto_publicar_jornal_cidades()
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
      url := 'https://umauozcntfxgphzbiifz.supabase.co/functions/v1/agente_publicador_05',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g',
        'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g'
      ),
      body := jsonb_build_object(
        'cidade_id', rec.cidade_id,
        'limit', 30,
        'max_age_days', 10
      ),
      timeout_milliseconds := 120000
    );
  END LOOP;
END;
$$;

DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN ('jornal-publicador-auto-safety');
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

SELECT cron.schedule(
  'jornal-publicador-auto-safety',
  '15 * * * *',
  $$SELECT public.run_auto_publicar_jornal_cidades();$$
);
