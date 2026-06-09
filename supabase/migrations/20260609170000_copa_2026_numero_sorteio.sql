alter table public.copa_2026_voucher
add column if not exists numero_sorteio integer;

with numbered as (
  select
    id,
    row_number() over (order by created_at asc, id asc) as numero
  from public.copa_2026_voucher
)
update public.copa_2026_voucher v
set numero_sorteio = numbered.numero
from numbered
where v.id = numbered.id
  and v.numero_sorteio is null;

create or replace function public.admin_copa_2026_normalizar_numeros()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_any_city(auth.uid()) then
    raise exception 'Acesso negado';
  end if;

  with numbered as (
    select
      id,
      row_number() over (order by coalesce(numero_sorteio, 2147483647), created_at asc, id asc) as numero
    from public.copa_2026_voucher
  )
  update public.copa_2026_voucher v
  set numero_sorteio = numbered.numero
  from numbered
  where v.id = numbered.id;
end;
$$;

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

  select v.id, coalesce(p.nome, 'Sem nome'), v.numero_sorteio
    into v_target_id, v_target_nome, v_target_numero
  from public.copa_2026_voucher v
  left join public.profiles p on p.id = v.user_id
  where lower(coalesce(p.nome, '')) like '%' || lower(trim(p_nome)) || '%'
  order by v.created_at asc, v.id asc
  limit 1;

  if v_target_id is null then
    raise exception 'Participante nao encontrado: %', p_nome;
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

drop function if exists public.admin_copa_2026_vouchers();

create function public.admin_copa_2026_vouchers()
returns table (
  id uuid,
  user_id uuid,
  cidade_slug text,
  voucher_codigo text,
  comprovante_path text,
  comprovante_nome text,
  created_at timestamptz,
  numero_sorteio integer,
  nome text,
  email text,
  contato text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.id,
    v.user_id,
    v.cidade_slug,
    v.voucher_codigo,
    v.comprovante_path,
    v.comprovante_nome,
    v.created_at,
    v.numero_sorteio,
    p.nome,
    p.email,
    p.contato
  from public.copa_2026_voucher v
  left join public.profiles p on p.id = v.user_id
  where public.is_admin_any_city(auth.uid())
  order by coalesce(v.numero_sorteio, 2147483647) asc, v.created_at asc;
$$;

grant execute on function public.admin_copa_2026_normalizar_numeros() to authenticated;
grant execute on function public.admin_copa_2026_liberar_numero(integer, text) to authenticated;
grant execute on function public.admin_copa_2026_vouchers() to authenticated;
