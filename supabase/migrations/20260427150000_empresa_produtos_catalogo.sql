-- Catalogo basico de produtos por empresa.

create table if not exists public.rel_cidade_servico_empresa_produto (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.rel_cidade_servico_empresa(id) on delete cascade,
  nome text not null,
  descricao text,
  preco numeric(12, 2),
  foto_url text,
  ativo boolean not null default true,
  ordem integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists rel_cidade_servico_empresa_produto_empresa_idx
  on public.rel_cidade_servico_empresa_produto (empresa_id, ordem, created_at);

alter table public.rel_cidade_servico_empresa_produto enable row level security;

create or replace function public.update_empresa_produto_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_empresa_produto_updated_at on public.rel_cidade_servico_empresa_produto;
create trigger trg_empresa_produto_updated_at
  before update on public.rel_cidade_servico_empresa_produto
  for each row
  execute function public.update_empresa_produto_updated_at();

drop policy if exists "Public can view active empresa produtos" on public.rel_cidade_servico_empresa_produto;
create policy "Public can view active empresa produtos"
  on public.rel_cidade_servico_empresa_produto
  for select
  using (ativo = true);

drop policy if exists "Owner can view empresa produtos" on public.rel_cidade_servico_empresa_produto;
create policy "Owner can view empresa produtos"
  on public.rel_cidade_servico_empresa_produto
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.rel_cidade_servico_empresa e
      where e.id = empresa_id
        and e.user_id = auth.uid()
    )
  );

drop policy if exists "Cidade admin can view empresa produtos" on public.rel_cidade_servico_empresa_produto;
create policy "Cidade admin can view empresa produtos"
  on public.rel_cidade_servico_empresa_produto
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.rel_cidade_servico_empresa e
      where e.id = empresa_id
        and public.is_admin_da_cidade(e.cidade_id, auth.uid())
    )
  );

drop policy if exists "Owner can insert empresa produtos" on public.rel_cidade_servico_empresa_produto;
create policy "Owner can insert empresa produtos"
  on public.rel_cidade_servico_empresa_produto
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.rel_cidade_servico_empresa e
      where e.id = empresa_id
        and e.user_id = auth.uid()
    )
  );

drop policy if exists "Owner can update empresa produtos" on public.rel_cidade_servico_empresa_produto;
create policy "Owner can update empresa produtos"
  on public.rel_cidade_servico_empresa_produto
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.rel_cidade_servico_empresa e
      where e.id = empresa_id
        and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.rel_cidade_servico_empresa e
      where e.id = empresa_id
        and e.user_id = auth.uid()
    )
  );

drop policy if exists "Owner can delete empresa produtos" on public.rel_cidade_servico_empresa_produto;
create policy "Owner can delete empresa produtos"
  on public.rel_cidade_servico_empresa_produto
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.rel_cidade_servico_empresa e
      where e.id = empresa_id
        and e.user_id = auth.uid()
    )
  );

drop policy if exists "Cidade admin can insert empresa produtos" on public.rel_cidade_servico_empresa_produto;
create policy "Cidade admin can insert empresa produtos"
  on public.rel_cidade_servico_empresa_produto
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.rel_cidade_servico_empresa e
      where e.id = empresa_id
        and public.is_admin_da_cidade(e.cidade_id, auth.uid())
    )
  );

drop policy if exists "Cidade admin can update empresa produtos" on public.rel_cidade_servico_empresa_produto;
create policy "Cidade admin can update empresa produtos"
  on public.rel_cidade_servico_empresa_produto
  for update
  to authenticated
  using (
    exists (
      select 1
      from public.rel_cidade_servico_empresa e
      where e.id = empresa_id
        and public.is_admin_da_cidade(e.cidade_id, auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.rel_cidade_servico_empresa e
      where e.id = empresa_id
        and public.is_admin_da_cidade(e.cidade_id, auth.uid())
    )
  );

drop policy if exists "Cidade admin can delete empresa produtos" on public.rel_cidade_servico_empresa_produto;
create policy "Cidade admin can delete empresa produtos"
  on public.rel_cidade_servico_empresa_produto
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.rel_cidade_servico_empresa e
      where e.id = empresa_id
        and public.is_admin_da_cidade(e.cidade_id, auth.uid())
    )
  );
