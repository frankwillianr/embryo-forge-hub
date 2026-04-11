ALTER TABLE public.rel_cidade_cinema
ADD COLUMN IF NOT EXISTS classificacao TEXT NULL,
ADD COLUMN IF NOT EXISTS idioma TEXT NULL,
ADD COLUMN IF NOT EXISTS situacao_exibicao TEXT NULL
CHECK (situacao_exibicao IN ('em_cartaz', 'em_breve', 'pre_venda', 'desconhecido'));