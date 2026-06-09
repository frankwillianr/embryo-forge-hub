create or replace function public.admin_copa_2026_liberar_numero(
  p_numero integer,
  p_nome text default 'clara brito'
)
returns table (
  numero_liberado integer,
  participante_fixado text,
  participante_trocado text,
  numero_anterior integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_id uuid;
  v_target_nome text;
  v_target_numero integer;
  v_other_id uuid;
  v_other_nome text;
begin
  if not public.is_admin_any_city(auth.uid()) then
    raise exception 'Acesso negado';
  end if;

  if p_numero is null or p_numero < 1 then
    raise exception 'Informe um numero valido';
  end if;

  perform public.admin_copa_2026_normalizar_numeros();

  select v.id, coalesce(p.nome, 'Clara Brito'), v.numero_sorteio
    into v_target_id, v_target_nome, v_target_numero
  from public.copa_2026_voucher v
  left join public.profiles p on p.id = v.user_id
  where v.voucher_codigo = 'COPA2026-IQIMAV'
  limit 1;

  if v_target_id is null then
    raise exception 'Voucher COPA2026-IQIMAV nao encontrado';
  end if;

  select v.id, coalesce(p.nome, 'Sem nome')
    into v_other_id, v_other_nome
  from public.copa_2026_voucher v
  left join public.profiles p on p.id = v.user_id
  where v.numero_sorteio = p_numero
    and v.id <> v_target_id
  limit 1;

  if v_target_numero = p_numero then
    return query select p_numero, v_target_nome, null::text, v_target_numero;
    return;
  end if;

  update public.copa_2026_voucher
  set numero_sorteio = -1,
      updated_at = now()
  where id = v_target_id;

  if v_other_id is not null then
    update public.copa_2026_voucher
    set numero_sorteio = v_target_numero,
        updated_at = now()
    where id = v_other_id;
  end if;

  update public.copa_2026_voucher
  set numero_sorteio = p_numero,
      updated_at = now()
  where id = v_target_id;

  return query select p_numero, v_target_nome, v_other_nome, v_target_numero;
end;
$$;

grant execute on function public.admin_copa_2026_liberar_numero(integer, text) to authenticated;
