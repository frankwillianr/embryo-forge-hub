create or replace function public.is_admin_any_city(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.rel_cidade_admin a
    where a.user_id = p_user_id
  );
$$;

grant execute on function public.is_admin_any_city(uuid) to authenticated;

create table if not exists public.copa_2026_voucher (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cidade_slug text not null,
  voucher_codigo text not null,
  instagram_post_url text not null default 'https://www.instagram.com/p/CvkU7o_LYvRjvaoodTS62zKsGIYrbqXIQJxhfc0/',
  comprovante_path text not null,
  comprovante_nome text,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'desclassificado')),
  data_sorteio date not null default date '2026-06-09',
  observacao text,
  verificado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists copa_2026_voucher_user_campaign_idx
  on public.copa_2026_voucher (user_id, instagram_post_url);

create unique index if not exists copa_2026_voucher_codigo_idx
  on public.copa_2026_voucher (voucher_codigo);

alter table public.copa_2026_voucher enable row level security;

drop policy if exists copa_2026_voucher_select_own_or_admin on public.copa_2026_voucher;
create policy copa_2026_voucher_select_own_or_admin
  on public.copa_2026_voucher for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_admin_any_city(auth.uid())
  );

drop policy if exists copa_2026_voucher_insert_own on public.copa_2026_voucher;
create policy copa_2026_voucher_insert_own
  on public.copa_2026_voucher for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists copa_2026_voucher_update_admin on public.copa_2026_voucher;
create policy copa_2026_voucher_update_admin
  on public.copa_2026_voucher for update
  to authenticated
  using (public.is_admin_any_city(auth.uid()))
  with check (public.is_admin_any_city(auth.uid()));

grant select, insert, update on public.copa_2026_voucher to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'copa-vouchers',
  'copa-vouchers',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Copa vouchers upload proprio" on storage.objects;
create policy "Copa vouchers upload proprio"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'copa-vouchers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Copa vouchers leitura proprio ou admin" on storage.objects;
create policy "Copa vouchers leitura proprio ou admin"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'copa-vouchers'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin_any_city(auth.uid())
    )
  );
