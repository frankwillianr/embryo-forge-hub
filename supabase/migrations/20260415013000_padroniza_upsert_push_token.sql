create or replace function public.upsert_cidade_push_token(
  p_cidade_id uuid,
  p_device_token text,
  p_platform text,
  p_user_id uuid default null,
  p_device_id text default null
)
returns table (
  id uuid,
  cidade_id uuid,
  user_id uuid,
  platform text,
  updated_at timestamptz
)
language sql
security definer
set search_path = public
as $fn$
  insert into public.rel_cidade_push_tokens (
    cidade_id,
    device_token,
    platform,
    user_id,
    device_id,
    updated_at
  )
  values (
    p_cidade_id,
    p_device_token,
    case
      when lower(coalesce(trim(p_platform), 'web')) in ('ios','android','web')
        then lower(coalesce(trim(p_platform), 'web'))
      else 'web'
    end,
    p_user_id,
    p_device_id,
    now()
  )
  on conflict (cidade_id, device_token)
  do update
  set
    platform = excluded.platform,
    device_id = coalesce(excluded.device_id, rel_cidade_push_tokens.device_id),
    user_id = coalesce(excluded.user_id, rel_cidade_push_tokens.user_id),
    updated_at = now()
  returning
    rel_cidade_push_tokens.id,
    rel_cidade_push_tokens.cidade_id,
    rel_cidade_push_tokens.user_id,
    rel_cidade_push_tokens.platform,
    rel_cidade_push_tokens.updated_at;
$fn$;

grant execute on function public.upsert_cidade_push_token(uuid, text, text, uuid, text)
to anon, authenticated;
