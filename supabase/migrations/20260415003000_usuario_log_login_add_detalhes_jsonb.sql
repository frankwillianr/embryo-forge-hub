alter table public.usuario_log_login
  add column if not exists detalhes jsonb null;

