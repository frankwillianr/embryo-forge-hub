-- Fontes de scraping dinamicas por cidade
CREATE TABLE IF NOT EXISTS cidade_scraping_fonte (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id UUID NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('rss', 'html')),
  url TEXT NOT NULL,
  local_gv BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 100,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cidade_id, nome)
);

ALTER TABLE cidade_scraping_fonte ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_fonte'
      AND policyname = 'cidade_scraping_fonte_select_authenticated'
  ) THEN
    CREATE POLICY cidade_scraping_fonte_select_authenticated
      ON cidade_scraping_fonte
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_fonte'
      AND policyname = 'cidade_scraping_fonte_insert_authenticated'
  ) THEN
    CREATE POLICY cidade_scraping_fonte_insert_authenticated
      ON cidade_scraping_fonte
      FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_fonte'
      AND policyname = 'cidade_scraping_fonte_update_authenticated'
  ) THEN
    CREATE POLICY cidade_scraping_fonte_update_authenticated
      ON cidade_scraping_fonte
      FOR UPDATE
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_fonte'
      AND policyname = 'cidade_scraping_fonte_delete_authenticated'
  ) THEN
    CREATE POLICY cidade_scraping_fonte_delete_authenticated
      ON cidade_scraping_fonte
      FOR DELETE
      TO authenticated
      USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_cidade_scraping_fonte_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cidade_scraping_fonte_updated_at ON cidade_scraping_fonte;
CREATE TRIGGER trg_cidade_scraping_fonte_updated_at
BEFORE UPDATE ON cidade_scraping_fonte
FOR EACH ROW
EXECUTE FUNCTION update_cidade_scraping_fonte_updated_at();

-- Seed inicial para Governador Valadares
INSERT INTO cidade_scraping_fonte (cidade_id, nome, tipo, url, local_gv, ativo, ordem)
VALUES
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'G1 Vales', 'rss', 'https://g1.globo.com/rss/g1/mg/vales-mg/', false, true, 10),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'Diario do Rio Doce', 'html', 'https://drd.com.br/', true, true, 20),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'Jornal da Cidade', 'html', 'https://jornaldacidadevalesdeminas.com/', true, true, 30),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'DeFato Online', 'html', 'https://defatoonline.com.br/localidades/governador-valadares/', false, true, 40)
ON CONFLICT (cidade_id, nome)
DO UPDATE SET
  tipo = EXCLUDED.tipo,
  url = EXCLUDED.url,
  local_gv = EXCLUDED.local_gv,
  ativo = true,
  ordem = EXCLUDED.ordem,
  updated_at = now();
