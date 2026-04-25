with alvos as (
  select id
  from public.rel_cidade_servico_empresa
  where banner_oferta_url is not null
    and status = 'ativo'
  order by random()
  limit 3
)
update public.rel_cidade_servico_empresa e
set visualizacoes = floor(random() * 501 + 1000)::bigint
from alvos
where e.id = alvos.id;
