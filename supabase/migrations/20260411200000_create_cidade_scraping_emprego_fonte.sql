CREATE TABLE IF NOT EXISTS public.cidade_scraping_emprego_fonte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id UUID NOT NULL REFERENCES public.cidade(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  url TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'auto' CHECK (tipo IN ('rss', 'html', 'auto')),
  ativo BOOLEAN NOT NULL DEFAULT TRUE,
  ordem INTEGER NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cidade_id, url)
);

CREATE INDEX IF NOT EXISTS idx_cidade_scraping_emprego_fonte_cidade
  ON public.cidade_scraping_emprego_fonte (cidade_id);

CREATE INDEX IF NOT EXISTS idx_cidade_scraping_emprego_fonte_cidade_ativo_ordem
  ON public.cidade_scraping_emprego_fonte (cidade_id, ativo, ordem);

ALTER TABLE public.cidade_scraping_emprego_fonte ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_emprego_fonte'
      AND policyname = 'cidade_scraping_emprego_fonte_select'
  ) THEN
    CREATE POLICY cidade_scraping_emprego_fonte_select
      ON public.cidade_scraping_emprego_fonte FOR SELECT TO authenticated USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_emprego_fonte'
      AND policyname = 'cidade_scraping_emprego_fonte_insert'
  ) THEN
    CREATE POLICY cidade_scraping_emprego_fonte_insert
      ON public.cidade_scraping_emprego_fonte FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_emprego_fonte'
      AND policyname = 'cidade_scraping_emprego_fonte_update'
  ) THEN
    CREATE POLICY cidade_scraping_emprego_fonte_update
      ON public.cidade_scraping_emprego_fonte FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_emprego_fonte'
      AND policyname = 'cidade_scraping_emprego_fonte_delete'
  ) THEN
    CREATE POLICY cidade_scraping_emprego_fonte_delete
      ON public.cidade_scraping_emprego_fonte FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.update_cidade_scraping_emprego_fonte_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cidade_scraping_emprego_fonte_updated_at ON public.cidade_scraping_emprego_fonte;
CREATE TRIGGER trg_cidade_scraping_emprego_fonte_updated_at
  BEFORE UPDATE ON public.cidade_scraping_emprego_fonte
  FOR EACH ROW EXECUTE FUNCTION public.update_cidade_scraping_emprego_fonte_updated_at();
