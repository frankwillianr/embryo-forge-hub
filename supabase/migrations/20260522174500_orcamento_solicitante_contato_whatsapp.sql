drop function if exists public.get_orcamento_solicitante_contato(uuid);

create or replace function public.get_orcamento_solicitante_contato(
  p_solicitacao_id uuid
)
returns table (
  nome text,
  email text,
  whatsapp text
)
language sql
security definer
set search_path = public
as $$
  select
    p.nome,
    p.email,
    coalesce(
      nullif(regexp_replace(coalesce(so.whatsapp, ''), '\D', '', 'g'), ''),
      nullif(regexp_replace(coalesce(p.contato, ''), '\D', '', 'g'), '')
    ) as whatsapp
  from public.solicitacao_orcamento so
  join public.profiles p on p.id = so.user_id
  where so.id = p_solicitacao_id
    and auth.uid() is not null
    and so.user_id <> auth.uid()
    and exists (
      select 1
      from public.rel_cidade_servico_empresa e
      where e.cidade_id = so.cidade_id
        and e.user_id = auth.uid()
    )
  limit 1;
$$;

revoke all on function public.get_orcamento_solicitante_contato(uuid) from public;
grant execute on function public.get_orcamento_solicitante_contato(uuid) to authenticated;
