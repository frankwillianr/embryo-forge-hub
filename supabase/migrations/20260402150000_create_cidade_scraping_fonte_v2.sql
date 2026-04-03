-- Fontes de scraping V2 — dinamicas por cidade (pipeline de agentes)
CREATE TABLE IF NOT EXISTS cidade_scraping_fonte_v2 (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id   UUID        NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  nome        TEXT        NOT NULL,
  url         TEXT        NOT NULL,
  tipo        TEXT        NOT NULL DEFAULT 'auto' CHECK (tipo IN ('rss', 'html', 'auto')),
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  ordem       INT         NOT NULL DEFAULT 100,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cidade_id, url)
);

ALTER TABLE cidade_scraping_fonte_v2 ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_fonte_v2'
      AND policyname = 'cidade_scraping_fonte_v2_select'
  ) THEN
    CREATE POLICY cidade_scraping_fonte_v2_select
      ON cidade_scraping_fonte_v2 FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_fonte_v2'
      AND policyname = 'cidade_scraping_fonte_v2_insert'
  ) THEN
    CREATE POLICY cidade_scraping_fonte_v2_insert
      ON cidade_scraping_fonte_v2 FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_fonte_v2'
      AND policyname = 'cidade_scraping_fonte_v2_update'
  ) THEN
    CREATE POLICY cidade_scraping_fonte_v2_update
      ON cidade_scraping_fonte_v2 FOR UPDATE TO authenticated
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_fonte_v2'
      AND policyname = 'cidade_scraping_fonte_v2_delete'
  ) THEN
    CREATE POLICY cidade_scraping_fonte_v2_delete
      ON cidade_scraping_fonte_v2 FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_cidade_scraping_fonte_v2_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cidade_scraping_fonte_v2_updated_at ON cidade_scraping_fonte_v2;
CREATE TRIGGER trg_cidade_scraping_fonte_v2_updated_at
  BEFORE UPDATE ON cidade_scraping_fonte_v2
  FOR EACH ROW EXECUTE FUNCTION update_cidade_scraping_fonte_v2_updated_at();
