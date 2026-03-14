-- Corrige KPI de online agora:
-- 1) contar usuario unico quando houver user_id (evita inflar por reabertura/sessoes)
-- 2) permitir marcar sessao offline imediatamente.

drop function if exists public.admin_online_now(integer);
create or replace function public.admin_online_now(p_window_minutes integer default 3)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(distinct coalesce(s.user_id::text, s.session_id))::bigint
  from public.app_online_session s
  where s.last_seen >= (now() - make_interval(mins => greatest(1, least(coalesce(p_window_minutes, 3), 60))));
$$;

grant execute on function public.admin_online_now(integer) to authenticated;

drop function if exists public.mark_online_session_offline(text);
create or replace function public.mark_online_session_offline(p_session_id text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.app_online_session
  where session_id = trim(coalesce(p_session_id, ''));
$$;

grant execute on function public.mark_online_session_offline(text) to anon, authenticated;
