do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'rel_cidade_push_tokens'
      and policyname = 'push_tokens_select_authenticated_for_upsert'
  ) then
    create policy push_tokens_select_authenticated_for_upsert
      on public.rel_cidade_push_tokens
      for select
      to authenticated
      using (true);
  end if;
end $$;

