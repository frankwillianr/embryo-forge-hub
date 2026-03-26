-- Agregacao geoespacial por intervalo de datas para o Dashboard Admin.

drop function if exists public.admin_access_geo_range(date, date, text);
create or replace function public.admin_access_geo_range(
  p_start_day date default current_date,
  p_end_day date default current_date,
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
  with params as (
    select
      least(coalesce(p_start_day, current_date), coalesce(p_end_day, current_date)) as start_day,
      greatest(coalesce(p_start_day, current_date), coalesce(p_end_day, current_date)) as end_day,
      coalesce(nullif(trim(p_cidade_slug), ''), 'governador-valadares') as cidade_slug
  ),
  base as (
    select
      round(e.latitude::numeric, 2)::double precision as latitude_bucket,
      round(e.longitude::numeric, 2)::double precision as longitude_bucket,
      coalesce(e.user_id::text, e.session_id) as actor_key
    from public.app_access_event e
    cross join params p
    where (e.created_at at time zone 'America/Sao_Paulo')::date between p.start_day and p.end_day
      and e.cidade_slug = p.cidade_slug
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

grant execute on function public.admin_access_geo_range(date, date, text) to authenticated;

