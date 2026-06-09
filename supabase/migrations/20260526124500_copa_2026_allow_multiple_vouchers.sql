drop index if exists public.copa_2026_voucher_user_campaign_idx;

create index if not exists copa_2026_voucher_user_campaign_lookup_idx
  on public.copa_2026_voucher (user_id, instagram_post_url, created_at desc);
