create or replace function public.admin_copa_2026_vouchers()
returns table (
  id uuid,
  user_id uuid,
  cidade_slug text,
  voucher_codigo text,
  comprovante_path text,
  comprovante_nome text,
  created_at timestamptz,
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
    p.nome,
    p.email,
    p.contato
  from public.copa_2026_voucher v
  left join public.profiles p on p.id = v.user_id
  where public.is_admin_any_city(auth.uid())
  order by v.created_at desc;
$$;

grant execute on function public.admin_copa_2026_vouchers() to authenticated;
