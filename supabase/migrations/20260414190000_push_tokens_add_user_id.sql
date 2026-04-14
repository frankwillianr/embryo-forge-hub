alter table public.rel_cidade_push_tokens
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists idx_rel_cidade_push_tokens_user
  on public.rel_cidade_push_tokens (user_id);

create index if not exists idx_rel_cidade_push_tokens_cidade_user
  on public.rel_cidade_push_tokens (cidade_id, user_id);

