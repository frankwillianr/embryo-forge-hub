-- Permite que admin da cidade gerencie as fotos das empresas da propria cidade.

alter table public.rel_cidade_servico_empresa_foto enable row level security;

drop policy if exists "Cidade admin can insert empresa fotos" on public.rel_cidade_servico_empresa_foto;
create policy "Cidade admin can insert empresa fotos"
  on public.rel_cidade_servico_empresa_foto
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

drop policy if exists "Cidade admin can update empresa fotos" on public.rel_cidade_servico_empresa_foto;
create policy "Cidade admin can update empresa fotos"
  on public.rel_cidade_servico_empresa_foto
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

drop policy if exists "Cidade admin can delete empresa fotos" on public.rel_cidade_servico_empresa_foto;
create policy "Cidade admin can delete empresa fotos"
  on public.rel_cidade_servico_empresa_foto
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
