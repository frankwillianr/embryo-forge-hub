-- Cupom de empresa "pego" pelo usuário (validade 30 dias, aparece em Meus cupons)
CREATE TABLE IF NOT EXISTS usuario_cupom_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES rel_cidade_servico_empresa(id) ON DELETE CASCADE,
  cidade_id UUID NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  validade DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, empresa_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_cupom_empresa_user ON usuario_cupom_empresa(user_id);
CREATE INDEX IF NOT EXISTS idx_usuario_cupom_empresa_validade ON usuario_cupom_empresa(validade);

ALTER TABLE usuario_cupom_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own usuario_cupom_empresa" ON usuario_cupom_empresa;
CREATE POLICY "Users can insert own usuario_cupom_empresa"
  ON usuario_cupom_empresa FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own usuario_cupom_empresa" ON usuario_cupom_empresa;
CREATE POLICY "Users can view own usuario_cupom_empresa"
  ON usuario_cupom_empresa FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE usuario_cupom_empresa IS 'Cupons de empresa que o usuário pegou; validade 30 dias; listados em Meus cupons.';
