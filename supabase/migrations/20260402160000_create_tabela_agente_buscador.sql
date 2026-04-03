-- Resultados do Agente Buscador V2 — artigos coletados crus antes do processamento
CREATE TABLE IF NOT EXISTS tabela_agente_buscador (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id        UUID        NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  fonte_id         UUID        REFERENCES cidade_scraping_fonte_v2(id) ON DELETE SET NULL,
  fonte_nome       TEXT,
  url              TEXT        NOT NULL,
  titulo           TEXT,
  descricao        TEXT,
  lista_imagens    TEXT[]      NOT NULL DEFAULT '{}',
  data_publicacao  DATE,
  status           TEXT        NOT NULL DEFAULT 'coletado'
                               CHECK (status IN ('coletado', 'processando', 'processado', 'erro')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (cidade_id, url)
);

ALTER TABLE tabela_agente_buscador ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tabela_agente_buscador'
      AND policyname = 'tabela_agente_buscador_select'
  ) THEN
    CREATE POLICY tabela_agente_buscador_select
      ON tabela_agente_buscador FOR SELECT TO authenticated USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tabela_agente_buscador'
      AND policyname = 'tabela_agente_buscador_insert'
  ) THEN
    CREATE POLICY tabela_agente_buscador_insert
      ON tabela_agente_buscador FOR INSERT TO authenticated WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tabela_agente_buscador'
      AND policyname = 'tabela_agente_buscador_update'
  ) THEN
    CREATE POLICY tabela_agente_buscador_update
      ON tabela_agente_buscador FOR UPDATE TO authenticated
      USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'tabela_agente_buscador'
      AND policyname = 'tabela_agente_buscador_delete'
  ) THEN
    CREATE POLICY tabela_agente_buscador_delete
      ON tabela_agente_buscador FOR DELETE TO authenticated USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_tabela_agente_buscador_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tabela_agente_buscador_updated_at ON tabela_agente_buscador;
CREATE TRIGGER trg_tabela_agente_buscador_updated_at
  BEFORE UPDATE ON tabela_agente_buscador
  FOR EACH ROW EXECUTE FUNCTION update_tabela_agente_buscador_updated_at();

-- Índices úteis
CREATE INDEX IF NOT EXISTS idx_tabela_agente_buscador_cidade_status
  ON tabela_agente_buscador (cidade_id, status);

CREATE INDEX IF NOT EXISTS idx_tabela_agente_buscador_created_at
  ON tabela_agente_buscador (created_at DESC);
