drop function if exists public.admin_buscar_usuarios_push(uuid, text, text, integer);

create or replace function public.admin_buscar_usuarios_push(
  p_cidade_id uuid,
  p_busca text default '',
  p_order text default 'last_seen',
  p_limit integer default 100
)
returns table (
  user_id uuid,
  nome text,
  email text,
  tokens_count bigint,
  platforms text,
  last_seen timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with token_users as (
    select
      t.user_id,
      count(distinct t.device_token)::bigint as tokens_count,
      string_agg(distinct t.platform, ', ' order by t.platform) as platforms
    from public.rel_cidade_push_tokens t
    where t.cidade_id = p_cidade_id
      and t.user_id is not null
    group by t.user_id
  ),
  online as (
    select
      s.user_id,
      max(s.last_seen) as last_seen
    from public.app_online_session s
    where s.user_id is not null
    group by s.user_id
  )
  select
    p.id as user_id,
    p.nome,
    p.email,
    coalesce(tu.tokens_count, 0)::bigint as tokens_count,
    coalesce(tu.platforms, '') as platforms,
    o.last_seen
  from public.profiles p
  left join token_users tu on tu.user_id = p.id
  left join online o on o.user_id = p.id
  where
    public.is_admin_da_cidade(p_cidade_id, auth.uid())
    and (
      trim(coalesce(p_busca, '')) = ''
      or p.nome ilike '%' || trim(p_busca) || '%'
      or p.email ilike '%' || trim(p_busca) || '%'
      or regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g')
         like '%' || regexp_replace(trim(coalesce(p_busca, '')), '\D', '', 'g') || '%'
    )
  order by
    case when lower(coalesce(p_order, 'last_seen')) = 'nome' then p.nome end asc nulls last,
    case when lower(coalesce(p_order, 'last_seen')) = 'last_seen' then o.last_seen end desc nulls last,
    p.nome asc nulls last
  limit greatest(1, least(coalesce(p_limit, 100), 300));
$$;

grant execute on function public.admin_buscar_usuarios_push(uuid, text, text, integer) to authenticated;

