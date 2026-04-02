-- Libera leitura publica de enquetes ativas e historico encerrado/cancelado.
-- Isso permite a tela "Ver todas enquetes" para usuarios anonimos/autenticados.

alter table public.rel_cidade_enquete enable row level security;

drop policy if exists rel_cidade_enquete_select_public_active_or_history on public.rel_cidade_enquete;
create policy rel_cidade_enquete_select_public_active_or_history
  on public.rel_cidade_enquete
  for select
  to anon, authenticated
  using (
    status = 'ativa'
    or status in ('encerrada', 'cancelada')
    or (data_fim is not null and data_fim < now())
  );
