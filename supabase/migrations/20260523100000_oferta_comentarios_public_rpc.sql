create or replace function public.listar_oferta_comentarios_public(p_empresa_id uuid)
returns table (
  id uuid,
  empresa_id uuid,
  user_id uuid,
  comentario text,
  created_at timestamptz,
  profile_nome text,
  profile_foto_url text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.id,
    c.empresa_id,
    c.user_id,
    c.comentario,
    c.created_at,
    p.nome as profile_nome,
    p.foto_url as profile_foto_url
  from public.rel_cidade_servico_empresa_comentarios c
  left join public.profiles p on p.id = c.user_id
  where c.empresa_id = p_empresa_id
  order by c.created_at desc;
$$;

revoke all on function public.listar_oferta_comentarios_public(uuid) from public;
grant execute on function public.listar_oferta_comentarios_public(uuid) to anon;
grant execute on function public.listar_oferta_comentarios_public(uuid) to authenticated;
