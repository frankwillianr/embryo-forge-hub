-- KPIs de recorrencia para dashboard admin.

drop function if exists public.admin_returning_users_kpis(integer);

create or replace function public.admin_returning_users_kpis(p_days integer default 30)
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
actor_totals as (
  select
    b.actor_key,
    count(*)::int as total_events
  from base b
  group by b.actor_key
),
summary as (
  select
    count(*)::int as unique_users,
    count(*) filter (where a.total_events = 1)::int as new_users,
    count(*) filter (where a.total_events > 1)::int as returning_users,
    coalesce(avg(a.total_events::numeric), 0)::numeric(10,2) as avg_sessions_per_user
  from actor_totals a
),
daily_raw as (
  select
    b.dia,
    count(distinct case when a.total_events = 1 then b.actor_key end)::int as new_users,
    count(distinct case when a.total_events > 1 then b.actor_key end)::int as returning_users,
    count(distinct b.actor_key)::int as unique_users
  from base b
  join actor_totals a on a.actor_key = b.actor_key
  group by b.dia
),
daily as (
  select
    d::date as dia,
    coalesce(r.new_users, 0)::int as new_users,
    coalesce(r.returning_users, 0)::int as returning_users,
    coalesce(r.unique_users, 0)::int as unique_users
  from params p
  cross join generate_series((current_date - (p.days - 1))::date, current_date::date, interval '1 day') d
  left join daily_raw r on r.dia = d::date
  order by d
)
select jsonb_build_object(
  'summary', (
    select jsonb_build_object(
      'unique_users', s.unique_users,
      'new_users', s.new_users,
      'returning_users', s.returning_users,
      'returning_rate', case when s.unique_users = 0 then 0 else round((s.returning_users::numeric / s.unique_users::numeric) * 100, 2) end,
      'avg_sessions_per_user', s.avg_sessions_per_user
    )
    from summary s
  ),
  'daily', (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date', to_char(d.dia, 'YYYY-MM-DD'),
          'new_users', d.new_users,
          'returning_users', d.returning_users,
          'unique_users', d.unique_users
        )
        order by d.dia
      ),
      '[]'::jsonb
    )
    from daily d
  )
);
$$;

grant execute on function public.admin_returning_users_kpis(integer) to authenticated;

