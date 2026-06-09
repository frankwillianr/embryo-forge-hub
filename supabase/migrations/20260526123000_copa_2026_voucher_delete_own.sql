drop policy if exists copa_2026_voucher_delete_own on public.copa_2026_voucher;
create policy copa_2026_voucher_delete_own
  on public.copa_2026_voucher for delete
  to authenticated
  using (user_id = auth.uid());

grant delete on public.copa_2026_voucher to authenticated;

drop policy if exists "Copa vouchers delete proprio" on storage.objects;
create policy "Copa vouchers delete proprio"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'copa-vouchers'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
