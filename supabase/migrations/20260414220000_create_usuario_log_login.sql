create table if not exists public.usuario_log_login (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid null references auth.users(id) on delete set null,
  cidade_id uuid null references public.cidade(id) on delete set null,
  cidade_slug text null,
  pagina text not null default 'cidade',
  evento text not null default 'cidade_open',
  push_permission_status text null,
  push_token_presente boolean null,
  push_token_prefix text null,
  push_error text null,
  app_platform text null
);

create index if not exists idx_usuario_log_login_created_at
  on public.usuario_log_login (created_at desc);

create index if not exists idx_usuario_log_login_user
  on public.usuario_log_login (user_id);

create index if not exists idx_usuario_log_login_cidade_slug
  on public.usuario_log_login (cidade_slug);

alter table public.usuario_log_login enable row level security;

drop policy if exists usuario_log_login_insert_public on public.usuario_log_login;
create policy usuario_log_login_insert_public
  on public.usuario_log_login
  for insert
  to anon, authenticated
  with check (true);

