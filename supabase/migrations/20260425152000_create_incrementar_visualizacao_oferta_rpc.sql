create or replace function public.incrementar_visualizacao_oferta(p_empresa_id uuid)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total bigint;
begin
  update public.rel_cidade_servico_empresa
  set visualizacoes = coalesce(visualizacoes, 0) + 1
  where id = p_empresa_id
    and status = 'ativo'
    and banner_oferta_url is not null
  returning visualizacoes into v_total;

  return coalesce(v_total, 0);
end;
$$;

comment on function public.incrementar_visualizacao_oferta(uuid) is
'Incrementa em 1 a visualizacao de uma oferta/empresa ativa e retorna o total atualizado.';

revoke all on function public.incrementar_visualizacao_oferta(uuid) from public;
grant execute on function public.incrementar_visualizacao_oferta(uuid) to anon;
grant execute on function public.incrementar_visualizacao_oferta(uuid) to authenticated;
