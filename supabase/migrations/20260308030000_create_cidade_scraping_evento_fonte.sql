CREATE TABLE IF NOT EXISTS cidade_scraping_evento_fonte (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id uuid NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text NOT NULL DEFAULT 'html' CHECK (tipo IN ('rss','html')),
  url text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cidade_id, nome)
);

ALTER TABLE cidade_scraping_evento_fonte ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_evento_fonte'
      AND policyname = 'cidade_scraping_evento_fonte_select_authenticated'
  ) THEN
    CREATE POLICY cidade_scraping_evento_fonte_select_authenticated
      ON cidade_scraping_evento_fonte
      FOR SELECT TO authenticated
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_evento_fonte'
      AND policyname = 'cidade_scraping_evento_fonte_insert_authenticated'
  ) THEN
    CREATE POLICY cidade_scraping_evento_fonte_insert_authenticated
      ON cidade_scraping_evento_fonte
      FOR INSERT TO authenticated
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_evento_fonte'
      AND policyname = 'cidade_scraping_evento_fonte_update_authenticated'
  ) THEN
    CREATE POLICY cidade_scraping_evento_fonte_update_authenticated
      ON cidade_scraping_evento_fonte
      FOR UPDATE TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'cidade_scraping_evento_fonte'
      AND policyname = 'cidade_scraping_evento_fonte_delete_authenticated'
  ) THEN
    CREATE POLICY cidade_scraping_evento_fonte_delete_authenticated
      ON cidade_scraping_evento_fonte
      FOR DELETE TO authenticated
      USING (true);
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION update_cidade_scraping_evento_fonte_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_cidade_scraping_evento_fonte_updated_at ON cidade_scraping_evento_fonte;
CREATE TRIGGER trg_cidade_scraping_evento_fonte_updated_at
BEFORE UPDATE ON cidade_scraping_evento_fonte
FOR EACH ROW
EXECUTE FUNCTION update_cidade_scraping_evento_fonte_updated_at();

INSERT INTO cidade_scraping_evento_fonte (cidade_id, nome, tipo, url, ativo, ordem)
VALUES
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'Sympla GV', 'html', 'https://www.sympla.com.br/eventos/governador-valadares-mg', true, 1),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'Eventbrite GV', 'html', 'https://www.eventbrite.com.br/d/brazil--governador-valadares/events/', true, 2),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'Ingresso.com', 'html', 'https://www.ingresso.com/', true, 3),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'Blueticket', 'html', 'https://www.blueticket.com.br/', true, 4),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'Bilheteria Digital', 'html', 'https://www.bilheteriadigital.com/', true, 5),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'G1 Vales', 'html', 'https://g1.globo.com/mg/vales-mg/', true, 6),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'DRD Cultura', 'html', 'https://drd.com.br/', true, 7),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'Prefeitura GV', 'html', 'https://www.valadares.mg.gov.br/', true, 8),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'Sesc MG', 'html', 'https://www.sescmg.com.br/', true, 9),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'Teatro Atiaia', 'html', 'https://www.instagram.com/teatroatiaia/', true, 10)
ON CONFLICT (cidade_id, nome) DO UPDATE SET
  tipo = EXCLUDED.tipo,
  url = EXCLUDED.url,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem,
  updated_at = now();
