do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'copa_2026_voucher'
  ) then
    alter publication supabase_realtime add table public.copa_2026_voucher;
  end if;
end $$;
