-- Permite que admin da cidade atualize/remova empresas da propria cidade.
-- Mantem a policy atual do dono da empresa, apenas adiciona permissao de admin.

alter table public.rel_cidade_servico_empresa enable row level security;

drop policy if exists "Cidade admin can update empresas" on public.rel_cidade_servico_empresa;
create policy "Cidade admin can update empresas"
  on public.rel_cidade_servico_empresa
  for update
  to authenticated
  using (public.is_admin_da_cidade(cidade_id, auth.uid()))
  with check (public.is_admin_da_cidade(cidade_id, auth.uid()));

drop policy if exists "Cidade admin can delete empresas" on public.rel_cidade_servico_empresa;
create policy "Cidade admin can delete empresas"
  on public.rel_cidade_servico_empresa
  for delete
  to authenticated
  using (public.is_admin_da_cidade(cidade_id, auth.uid()));

