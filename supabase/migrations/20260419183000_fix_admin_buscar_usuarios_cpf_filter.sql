-- Corrige busca de usuarios no admin: evita que filtro de CPF vire coringa (%%)
-- quando a busca e por email/nome sem digitos.
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
      or (
        regexp_replace(trim(coalesce(p_busca, '')), '\\D', '', 'g') <> ''
        and regexp_replace(coalesce(p.cpf, ''), '\\D', '', 'g')
            like '%' || regexp_replace(trim(coalesce(p_busca, '')), '\\D', '', 'g') || '%'
      )
    )
  order by p.nome nulls last
  limit greatest(1, least(coalesce(p_limit, 10), 50));
$$;
