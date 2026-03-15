-- Armazena geolocalizacao aproximada dos acessos e expoe pontos agregados por dia para o dashboard admin.

alter table if exists public.app_access_event
  add column if not exists latitude double precision null,
  add column if not exists longitude double precision null,
  add column if not exists accuracy_meters double precision null;

drop function if exists public.track_app_access(text, text, uuid);
drop function if exists public.track_app_access(text, text, uuid, double precision, double precision, double precision);
create or replace function public.track_app_access(
  p_cidade_slug text,
  p_session_id text,
  p_user_id uuid default null,
  p_latitude double precision default null,
  p_longitude double precision default null,
  p_accuracy_meters double precision default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latitude double precision;
  v_longitude double precision;
  v_accuracy double precision;
begin
  if coalesce(trim(p_cidade_slug), '') = '' or coalesce(trim(p_session_id), '') = '' then
    return;
  end if;

  if exists (
    select 1
    from public.app_access_event e
    where e.cidade_slug = trim(p_cidade_slug)
      and e.session_id = trim(p_session_id)
      and e.created_at >= (now() - interval '30 minutes')
  ) then
    return;
  end if;

  if p_latitude between -90 and 90 then
    v_latitude := p_latitude;
  else
    v_latitude := null;
  end if;

  if p_longitude between -180 and 180 then
    v_longitude := p_longitude;
  else
    v_longitude := null;
  end if;

  if p_accuracy_meters is not null and p_accuracy_meters >= 0 and p_accuracy_meters <= 100000 then
    v_accuracy := p_accuracy_meters;
  else
    v_accuracy := null;
  end if;

  insert into public.app_access_event (cidade_slug, user_id, session_id, latitude, longitude, accuracy_meters)
  values (trim(p_cidade_slug), p_user_id, trim(p_session_id), v_latitude, v_longitude, v_accuracy);
end;
$$;

grant execute on function public.track_app_access(text, text, uuid, double precision, double precision, double precision) to anon, authenticated;

drop function if exists public.admin_access_geo_daily(date);
create or replace function public.admin_access_geo_daily(p_day date default current_date)
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

grant execute on function public.admin_access_geo_daily(date) to authenticated;
