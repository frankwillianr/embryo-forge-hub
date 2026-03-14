-- Estatisticas do dashboard admin com bypass de RLS via SECURITY DEFINER.

drop function if exists public.admin_dashboard_stats();

create or replace function public.admin_dashboard_stats()
returns table (
  total_cidades bigint,
  total_usuarios bigint,
  acessos_30_dias bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*)::bigint from public.cidade) as total_cidades,
    (select count(*)::bigint from public.profiles) as total_usuarios,
    (
      select count(distinct c.user_id)::bigint
      from public.checkin c
      where c.data >= (current_date - interval '30 days')::date
    ) as acessos_30_dias;
$$;

grant execute on function public.admin_dashboard_stats() to authenticated;
