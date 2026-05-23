create table if not exists public.rel_cidade_servico_empresa_reacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rel_cidade_servico_empresa(id) on delete cascade,
  user_fingerprint text not null,
  tipo text not null check (tipo in ('like', 'dislike')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa_id, user_fingerprint)
);

create index if not exists idx_servico_empresa_reacoes_empresa
  on public.rel_cidade_servico_empresa_reacoes (empresa_id);

create table if not exists public.rel_cidade_servico_empresa_comentarios (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rel_cidade_servico_empresa(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  comentario text not null check (char_length(trim(comentario)) > 0 and char_length(comentario) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_servico_empresa_comentarios_empresa_created
  on public.rel_cidade_servico_empresa_comentarios (empresa_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_servico_empresa_reacoes_updated_at on public.rel_cidade_servico_empresa_reacoes;
create trigger trg_servico_empresa_reacoes_updated_at
before update on public.rel_cidade_servico_empresa_reacoes
for each row execute function public.set_updated_at();

drop trigger if exists trg_servico_empresa_comentarios_updated_at on public.rel_cidade_servico_empresa_comentarios;
create trigger trg_servico_empresa_comentarios_updated_at
before update on public.rel_cidade_servico_empresa_comentarios
for each row execute function public.set_updated_at();

alter table public.rel_cidade_servico_empresa_reacoes enable row level security;
alter table public.rel_cidade_servico_empresa_comentarios enable row level security;

drop policy if exists "Reacoes de ofertas sao publicas para leitura" on public.rel_cidade_servico_empresa_reacoes;
create policy "Reacoes de ofertas sao publicas para leitura"
on public.rel_cidade_servico_empresa_reacoes
for select
using (true);

drop policy if exists "Visitantes podem reagir a ofertas" on public.rel_cidade_servico_empresa_reacoes;
create policy "Visitantes podem reagir a ofertas"
on public.rel_cidade_servico_empresa_reacoes
for insert
with check (
  user_fingerprint is not null
  and char_length(trim(user_fingerprint)) > 0
  and tipo in ('like', 'dislike')
);

drop policy if exists "Visitantes podem atualizar propria reacao por fingerprint" on public.rel_cidade_servico_empresa_reacoes;
create policy "Visitantes podem atualizar propria reacao por fingerprint"
on public.rel_cidade_servico_empresa_reacoes
for update
using (user_fingerprint is not null and char_length(trim(user_fingerprint)) > 0)
with check (
  user_fingerprint is not null
  and char_length(trim(user_fingerprint)) > 0
  and tipo in ('like', 'dislike')
);

drop policy if exists "Visitantes podem remover propria reacao por fingerprint" on public.rel_cidade_servico_empresa_reacoes;
create policy "Visitantes podem remover propria reacao por fingerprint"
on public.rel_cidade_servico_empresa_reacoes
for delete
using (user_fingerprint is not null and char_length(trim(user_fingerprint)) > 0);

drop policy if exists "Comentarios de ofertas sao publicos para leitura" on public.rel_cidade_servico_empresa_comentarios;
create policy "Comentarios de ofertas sao publicos para leitura"
on public.rel_cidade_servico_empresa_comentarios
for select
using (true);

drop policy if exists "Usuarios autenticados podem comentar ofertas" on public.rel_cidade_servico_empresa_comentarios;
create policy "Usuarios autenticados podem comentar ofertas"
on public.rel_cidade_servico_empresa_comentarios
for insert
with check (auth.uid() = user_id);

drop policy if exists "Usuarios podem editar seus comentarios de ofertas" on public.rel_cidade_servico_empresa_comentarios;
create policy "Usuarios podem editar seus comentarios de ofertas"
on public.rel_cidade_servico_empresa_comentarios
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Usuarios podem excluir seus comentarios de ofertas" on public.rel_cidade_servico_empresa_comentarios;
create policy "Usuarios podem excluir seus comentarios de ofertas"
on public.rel_cidade_servico_empresa_comentarios
for delete
using (auth.uid() = user_id);

grant select, insert, update, delete on public.rel_cidade_servico_empresa_reacoes to anon, authenticated;
grant select on public.rel_cidade_servico_empresa_comentarios to anon, authenticated;
grant insert, update, delete on public.rel_cidade_servico_empresa_comentarios to authenticated;
