-- Filtra mapa de acessos por cidade, com default em Governador Valadares.

drop function if exists public.admin_access_geo_daily(date);
drop function if exists public.admin_access_geo_daily(date, text);
create or replace function public.admin_access_geo_daily(
  p_day date default current_date,
  p_cidade_slug text default 'governador-valadares'
)
returns table (
  latitude double precision,
  longitude double precision,
  users integer,
  events integer
)
language sql
stable
security definer
set search_path = public
as $$
  with base as (
    select
      round(e.latitude::numeric, 2)::double precision as latitude_bucket,
      round(e.longitude::numeric, 2)::double precision as longitude_bucket,
      coalesce(e.user_id::text, e.session_id) as actor_key
    from public.app_access_event e
    where (e.created_at at time zone 'America/Sao_Paulo')::date = coalesce(p_day, current_date)
      and e.cidade_slug = coalesce(nullif(trim(p_cidade_slug), ''), 'governador-valadares')
      and e.latitude is not null
      and e.longitude is not null
  )
  select
    b.latitude_bucket as latitude,
    b.longitude_bucket as longitude,
    count(distinct b.actor_key)::int as users,
    count(*)::int as events
  from base b
  group by b.latitude_bucket, b.longitude_bucket
  order by users desc, events desc
  limit 400;
$$;

grant execute on function public.admin_access_geo_daily(date, text) to authenticated;
