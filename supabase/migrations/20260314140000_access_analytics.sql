-- Tracking leve de acesso e analytics para dashboard admin.

create table if not exists public.app_access_event (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  cidade_slug text not null,
  user_id uuid null references auth.users(id) on delete set null,
  session_id text not null
);

create index if not exists idx_app_access_event_created_at on public.app_access_event (created_at desc);
create index if not exists idx_app_access_event_cidade_slug on public.app_access_event (cidade_slug);
create index if not exists idx_app_access_event_user_id on public.app_access_event (user_id);
create index if not exists idx_app_access_event_session_id on public.app_access_event (session_id);

alter table public.app_access_event enable row level security;

drop policy if exists app_access_insert_public on public.app_access_event;
create policy app_access_insert_public
  on public.app_access_event
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists app_access_select_authenticated on public.app_access_event;
create policy app_access_select_authenticated
  on public.app_access_event
  for select
  to authenticated
  using (true);

drop function if exists public.track_app_access(text, text, uuid);
create or replace function public.track_app_access(
  p_cidade_slug text,
  p_session_id text,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_cidade_slug), '') = '' or coalesce(trim(p_session_id), '') = '' then
    return;
  end if;

  -- throttle no banco: no maximo 1 evento por sessao/cidade a cada 30 minutos.
  if exists (
    select 1
    from public.app_access_event e
    where e.cidade_slug = trim(p_cidade_slug)
      and e.session_id = trim(p_session_id)
      and e.created_at >= (now() - interval '30 minutes')
  ) then
    return;
  end if;

  insert into public.app_access_event (cidade_slug, user_id, session_id)
  values (trim(p_cidade_slug), p_user_id, trim(p_session_id));
end;
$$;

grant execute on function public.track_app_access(text, text, uuid) to anon, authenticated;

drop function if exists public.admin_access_analytics(integer);
create or replace function public.admin_access_analytics(p_days integer default 30)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with
params as (
  select greatest(7, least(coalesce(p_days, 30), 365))::int as days
),
base as (
  select
    e.created_at,
    e.created_at::date as dia,
    coalesce(e.user_id::text, e.session_id) as actor_key
  from public.app_access_event e
  cross join params p
  where e.created_at >= (now() - make_interval(days => p.days))
),
daily_raw as (
  select
    b.dia,
    count(distinct b.actor_key)::int as usuarios
  from base b
  group by b.dia
),
daily as (
  select
    d::date as dia,
    coalesce(r.usuarios, 0)::int as usuarios
  from params p
  cross join generate_series((current_date - (p.days - 1))::date, current_date::date, interval '1 day') d
  left join daily_raw r on r.dia = d::date
  order by d
),
summary as (
  select
    count(distinct case when b.created_at >= date_trunc('day', now()) then b.actor_key end)::int as hoje,
    count(distinct case when b.created_at >= date_trunc('week', now()) then b.actor_key end)::int as semana,
    count(distinct case when b.created_at >= date_trunc('month', now()) then b.actor_key end)::int as mes
  from base b
),
period_stats as (
  select
    case
      when extract(hour from b.created_at) between 6 and 11 then 'manha'
      when extract(hour from b.created_at) between 12 and 17 then 'tarde'
      when extract(hour from b.created_at) between 18 and 23 then 'noite'
      else 'madrugada'
    end as periodo,
    count(distinct b.actor_key)::int as usuarios
  from base b
  group by 1
),
peak as (
  select p.periodo, p.usuarios
  from period_stats p
  order by p.usuarios desc, p.periodo
  limit 1
)
select jsonb_build_object(
  'daily', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date', to_char(d.dia, 'YYYY-MM-DD'),
          'users', d.usuarios
        )
        order by d.dia
      ),
      '[]'::jsonb
    )
    from daily d
  ),
  'summary', (
    select jsonb_build_object(
      'today', s.hoje,
      'week', s.semana,
      'month', s.mes
    )
    from summary s
  ),
  'peak', (
    select jsonb_build_object(
      'period', coalesce(p.periodo, '-'),
      'users', coalesce(p.usuarios, 0)
    )
    from peak p
  )
);
$$;

grant execute on function public.admin_access_analytics(integer) to authenticated;

create table if not exists public.app_online_session (
  session_id text primary key,
  user_id uuid null references auth.users(id) on delete set null,
  cidade_slug text null,
  last_seen timestamptz not null default now()
);

create index if not exists idx_app_online_session_last_seen on public.app_online_session (last_seen desc);
create index if not exists idx_app_online_session_user_id on public.app_online_session (user_id);

alter table public.app_online_session enable row level security;

drop policy if exists app_online_session_insert_public on public.app_online_session;
create policy app_online_session_insert_public
  on public.app_online_session
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists app_online_session_update_public on public.app_online_session;
create policy app_online_session_update_public
  on public.app_online_session
  for update
  to anon, authenticated
  using (true)
  with check (true);

drop function if exists public.upsert_online_session(text, text, uuid);
create or replace function public.upsert_online_session(
  p_cidade_slug text,
  p_session_id text,
  p_user_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(trim(p_session_id), '') = '' then
    return;
  end if;

  insert into public.app_online_session (session_id, user_id, cidade_slug, last_seen)
  values (trim(p_session_id), p_user_id, nullif(trim(p_cidade_slug), ''), now())
  on conflict (session_id)
  do update
  set
    user_id = excluded.user_id,
    cidade_slug = excluded.cidade_slug,
    last_seen = now();
end;
$$;

grant execute on function public.upsert_online_session(text, text, uuid) to anon, authenticated;

drop function if exists public.admin_online_now(integer);
create or replace function public.admin_online_now(p_window_minutes integer default 3)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.app_online_session s
  where s.last_seen >= (now() - make_interval(mins => greatest(1, least(coalesce(p_window_minutes, 3), 60))));
$$;

grant execute on function public.admin_online_now(integer) to authenticated;
