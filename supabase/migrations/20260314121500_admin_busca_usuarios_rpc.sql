-- RPCs para busca/listagem de admins de cidade sem depender de leitura direta em profiles via cliente.

drop function if exists public.admin_buscar_usuarios(text, uuid, integer);
drop function if exists public.admin_buscar_usuarios(uuid, text, integer);

create or replace function public.admin_buscar_usuarios(
  p_cidade_id uuid,
  p_busca text,
  p_limit integer default 10
)
returns table (
  id uuid,
  nome text,
  email text,
  cpf text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.nome,
    p.email,
    p.cpf
  from public.profiles p
  where
    public.is_admin_da_cidade(p_cidade_id, auth.uid())
    and (
      p.email ilike '%' || trim(coalesce(p_busca, '')) || '%'
      or p.nome ilike '%' || trim(coalesce(p_busca, '')) || '%'
      or regexp_replace(coalesce(p.cpf, ''), '\D', '', 'g')
         like '%' || regexp_replace(trim(coalesce(p_busca, '')), '\D', '', 'g') || '%'
    )
  order by p.nome nulls last
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;

grant execute on function public.admin_buscar_usuarios(uuid, text, integer) to authenticated;

create or replace function public.admin_listar_admins_cidade(
  p_cidade_id uuid
)
returns table (
  rel_id uuid,
  user_id uuid,
  nome text,
  email text,
  cpf text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id as rel_id,
    a.user_id,
    p.nome,
    p.email,
    p.cpf,
    a.created_at
  from public.rel_cidade_admin a
  left join public.profiles p on p.id = a.user_id
  where
    a.cidade_id = p_cidade_id
    and public.is_admin_da_cidade(p_cidade_id, auth.uid())
  order by a.created_at desc;
$$;

grant execute on function public.admin_listar_admins_cidade(uuid) to authenticated;
