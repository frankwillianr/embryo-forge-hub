-- Ajusta throttle de tracking para considerar ator (user_id quando logado, senao session_id).

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
  v_actor_key text;
begin
  if coalesce(trim(p_cidade_slug), '') = '' or coalesce(trim(p_session_id), '') = '' then
    return;
  end if;

  v_actor_key := coalesce(p_user_id::text, trim(p_session_id));

  if exists (
    select 1
    from public.app_access_event e
    where e.cidade_slug = trim(p_cidade_slug)
      and coalesce(e.user_id::text, e.session_id) = v_actor_key
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
