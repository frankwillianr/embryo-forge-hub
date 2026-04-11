ALTER TABLE public.filmes_scraping
ADD COLUMN IF NOT EXISTS dias_exibicao JSONB NOT NULL DEFAULT '[]'::jsonb;