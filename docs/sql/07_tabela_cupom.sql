-- Rode 7º. Tabela de cupons de desconto.
CREATE TABLE IF NOT EXISTS cupom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id UUID NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  codigo TEXT NOT NULL,
  codigo_censurado TEXT NOT NULL,
  checkins_necessarios INT NOT NULL DEFAULT 7,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cupom_cidade ON cupom(cidade_id);
CREATE INDEX IF NOT EXISTS idx_cupom_ativo ON cupom(ativo) WHERE ativo = true;

ALTER TABLE cupom ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view cupom list" ON cupom;
DROP POLICY IF EXISTS "Authenticated can view cupom" ON cupom;
CREATE POLICY "Authenticated can view cupom"
  ON cupom FOR SELECT TO authenticated
  USING (ativo = true);

COMMENT ON TABLE cupom IS 'Cupons; código revelado após checkins_necessarios dias.';
