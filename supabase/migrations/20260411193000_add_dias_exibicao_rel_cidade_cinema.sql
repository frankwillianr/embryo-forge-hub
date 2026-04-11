ALTER TABLE public.rel_cidade_cinema
ADD COLUMN IF NOT EXISTS dias_exibicao JSONB NOT NULL DEFAULT '[]'::jsonb;