create or replace function public.listar_jornal_comentarios_public(p_jornal_id uuid)
returns table (
  id uuid,
  jornal_id uuid,
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
    c.jornal_id,
    c.user_id,
    c.comentario,
    c.created_at,
    p.nome as profile_nome,
    p.foto_url as profile_foto_url
  from public.rel_cidade_jornal_comentarios c
  left join public.profiles p on p.id = c.user_id
  where c.jornal_id = p_jornal_id
  order by c.created_at desc;
$$;

revoke all on function public.listar_jornal_comentarios_public(uuid) from public;
grant execute on function public.listar_jornal_comentarios_public(uuid) to anon;
grant execute on function public.listar_jornal_comentarios_public(uuid) to authenticated;
