with ofertas_video as (
  select
    id,
    (50 + floor(random() * 71))::int as total_seed
  from public.rel_cidade_servico_empresa
  where status = 'ativo'
    and video_url is not null
    and trim(video_url) <> ''
)
insert into public.rel_cidade_servico_empresa_reacoes (
  empresa_id,
  user_fingerprint,
  tipo
)
select
  ofertas_video.id,
  'seed-guia-like-' || ofertas_video.id::text || '-' || gs::text,
  'like'
from ofertas_video
cross join lateral generate_series(1, ofertas_video.total_seed) as gs
on conflict (empresa_id, user_fingerprint) do nothing;
