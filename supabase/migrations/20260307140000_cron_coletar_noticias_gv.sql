-- ─────────────────────────────────────────────────────────────────────────────
-- Agendamento automático: coletar-noticias-gv
-- Horários UTC (BRT = UTC-3): 11h → 8h BRT | 14h → 11h BRT | 17h → 14h BRT | 22h → 19h BRT
--
-- Pré-requisitos no Supabase Dashboard:
--   1. Database → Extensions → habilitar "pg_cron"
--   2. Database → Extensions → habilitar "pg_net" (geralmente já está ativo)
-- ─────────────────────────────────────────────────────────────────────────────

-- Remove jobs anteriores se existirem (idempotente)
DO $$
BEGIN
  PERFORM cron.unschedule(jobname)
  FROM cron.job
  WHERE jobname IN (
    'coletar-noticias-gv-11h',
    'coletar-noticias-gv-14h',
    'coletar-noticias-gv-17h',
    'coletar-noticias-gv-22h'
  );
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- ── Job 1: 11h UTC (8h BRT) ───────────────────────────────────────────────────
SELECT cron.schedule(
  'coletar-noticias-gv-11h',
  '0 11 * * *',
  $$
  SELECT net.http_post(
    url         := 'https://umauozcntfxgphzbiifz.supabase.co/functions/v1/coletar-noticias-gv',
    headers     := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g"}'::jsonb,
    body        := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) AS request_id;
  $$
);

-- ── Job 2: 14h UTC (11h BRT) ─────────────────────────────────────────────────
SELECT cron.schedule(
  'coletar-noticias-gv-14h',
  '0 14 * * *',
  $$
  SELECT net.http_post(
    url         := 'https://umauozcntfxgphzbiifz.supabase.co/functions/v1/coletar-noticias-gv',
    headers     := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g"}'::jsonb,
    body        := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) AS request_id;
  $$
);

-- ── Job 3: 17h UTC (14h BRT) ─────────────────────────────────────────────────
SELECT cron.schedule(
  'coletar-noticias-gv-17h',
  '0 17 * * *',
  $$
  SELECT net.http_post(
    url         := 'https://umauozcntfxgphzbiifz.supabase.co/functions/v1/coletar-noticias-gv',
    headers     := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g"}'::jsonb,
    body        := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) AS request_id;
  $$
);

-- ── Job 4: 22h UTC (19h BRT) ─────────────────────────────────────────────────
SELECT cron.schedule(
  'coletar-noticias-gv-22h',
  '0 22 * * *',
  $$
  SELECT net.http_post(
    url         := 'https://umauozcntfxgphzbiifz.supabase.co/functions/v1/coletar-noticias-gv',
    headers     := '{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYXVvemNudGZ4Z3BoemJpaWZ6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAwODk3ODksImV4cCI6MjA4NTY2NTc4OX0.xiB4Tr3j8lQVoeaLlj0O_Dk4HZGQg_ciKa3AE8Joi1g"}'::jsonb,
    body        := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) AS request_id;
  $$
);
