-- Marca chamadas vindas do pg_cron para facilitar diagnostico na edge function.
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
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1bWF1b3pjbnRmeGdwaHpiaWlmeiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcwMDg5Nzg5LCJleHAiOjIwODU2NjU3ODl9.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g',
        'Authorization', 'Bearer ' || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJ1bWF1b3pjbnRmeGdwaHpiaWlmeiIsInJvbGUiOiJhbm9uIiwiaWF0IjoxNzcwMDg5Nzg5LCJleHAiOjIwODU2NjU3ODl9.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g',
        'x-cron-origin', 'pg_cron'
      ),
      body := jsonb_build_object('cidade_id', rec.cidade_id),
      timeout_milliseconds := 300000
    );
  END LOOP;
END;
$$;

