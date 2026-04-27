-- Permite que administradores da cidade moderem anuncios do Marketplace Local.

alter table public.rel_cidade_desapega enable row level security;

drop policy if exists "Cidade admin can update marketplace" on public.rel_cidade_desapega;
create policy "Cidade admin can update marketplace"
  on public.rel_cidade_desapega
  for update
  to authenticated
  using (public.is_admin_da_cidade(cidade_id, auth.uid()))
  with check (public.is_admin_da_cidade(cidade_id, auth.uid()));
