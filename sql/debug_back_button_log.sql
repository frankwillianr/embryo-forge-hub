create table if not exists debug_back_button_log (
  id uuid default gen_random_uuid() primary key,
  created_at timestamptz default now(),
  pathname text,
  parent_route text,
  action_taken text,
  history_length int,
  is_native_platform boolean,
  capacitor_platform text,
  user_agent text,
  referrer text,
  location_key text,
  location_search text,
  location_hash text,
  extra jsonb default '{}'
);

-- Permitir insert para qualquer um (debug temporário)
alter table debug_back_button_log enable row level security;

create policy "anyone can insert debug logs"
  on debug_back_button_log
  for insert
  to anon, authenticated
  with check (true);

create policy "anyone can read debug logs"
  on debug_back_button_log
  for select
  to anon, authenticated
  using (true);
