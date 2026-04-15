create or replace function public.rel_cidade_push_tokens_preserve_user_id()
returns trigger
language plpgsql
as $$
begin
  if old.user_id is not null and new.user_id is null then
    new.user_id := old.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rel_cidade_push_tokens_preserve_user_id on public.rel_cidade_push_tokens;
create trigger trg_rel_cidade_push_tokens_preserve_user_id
before update on public.rel_cidade_push_tokens
for each row
execute function public.rel_cidade_push_tokens_preserve_user_id();

