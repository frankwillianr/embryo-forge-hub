CREATE TABLE IF NOT EXISTS public.filmes_scraping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id UUID NOT NULL REFERENCES public.cidade(id) ON DELETE CASCADE,
  fonte_id UUID NULL REFERENCES public.cidade_scraping_cinema_fonte(id) ON DELETE SET NULL,
  fonte_nome TEXT NULL,
  site_url TEXT NOT NULL,
  url_origem TEXT NULL,
  titulo TEXT NOT NULL,
  sinopse TEXT NULL,
  genero TEXT NULL,
  duracao TEXT NULL,
  classificacao TEXT NULL,
  idioma TEXT NULL,
  data_estreia TEXT NULL,
  poster_url TEXT NULL,
  trailer_url TEXT NULL,
  horarios JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'coletado' CHECK (status IN ('coletado', 'processado', 'descartado', 'erro')),
  dedupe_key TEXT NOT NULL,
  dados_brutos JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cidade_id, dedupe_key)
);

CREATE INDEX IF NOT EXISTS idx_filmes_scraping_cidade_status
  ON public.filmes_scraping (cidade_id, status);

CREATE INDEX IF NOT EXISTS idx_filmes_scraping_cidade_created
  ON public.filmes_scraping (cidade_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_filmes_scraping_cidade_titulo
  ON public.filmes_scraping (cidade_id, titulo);

ALTER TABLE public.filmes_scraping ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'filmes_scraping'
      AND policyname = 'filmes_scraping_select'
  ) THEN
    CREATE POLICY filmes_scraping_select
      ON public.filmes_scraping
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'filmes_scraping'
      AND policyname = 'filmes_scraping_insert'
  ) THEN
    CREATE POLICY filmes_scraping_insert
      ON public.filmes_scraping
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'filmes_scraping'
      AND policyname = 'filmes_scraping_update'
  ) THEN
    CREATE POLICY filmes_scraping_update
      ON public.filmes_scraping
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'filmes_scraping'
      AND policyname = 'filmes_scraping_delete'
  ) THEN
    CREATE POLICY filmes_scraping_delete
      ON public.filmes_scraping
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_filmes_scraping_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_filmes_scraping_updated_at ON public.filmes_scraping;
CREATE TRIGGER trg_filmes_scraping_updated_at
  BEFORE UPDATE ON public.filmes_scraping
  FOR EACH ROW
  EXECUTE FUNCTION public.update_filmes_scraping_updated_at();
