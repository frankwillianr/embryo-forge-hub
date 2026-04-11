ALTER TABLE public.filmes_scraping
ADD COLUMN IF NOT EXISTS situacao_exibicao TEXT NOT NULL DEFAULT 'desconhecido'
CHECK (situacao_exibicao IN ('em_cartaz', 'em_breve', 'pre_venda', 'desconhecido'));

CREATE INDEX IF NOT EXISTS idx_filmes_scraping_cidade_situacao
  ON public.filmes_scraping (cidade_id, situacao_exibicao);