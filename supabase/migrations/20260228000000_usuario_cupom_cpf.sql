-- CPF no perfil (para exibir no cupom como proteção contra compartilhamento)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS cpf TEXT;

COMMENT ON COLUMN profiles.cpf IS 'CPF do usuário; exibido no cupom ao pegar (proteção contra print/screenshot)';

-- Cupom "pego" pelo usuário: status pego + validade 30 dias
CREATE TABLE IF NOT EXISTS usuario_cupom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cupom_id UUID NOT NULL REFERENCES cupom(id) ON DELETE CASCADE,
  cidade_id UUID NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  validade DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, cupom_id)
);

CREATE INDEX IF NOT EXISTS idx_usuario_cupom_user ON usuario_cupom(user_id);
CREATE INDEX IF NOT EXISTS idx_usuario_cupom_validade ON usuario_cupom(validade);

ALTER TABLE usuario_cupom ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own usuario_cupom" ON usuario_cupom;
CREATE POLICY "Users can insert own usuario_cupom"
  ON usuario_cupom FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own usuario_cupom" ON usuario_cupom;
CREATE POLICY "Users can view own usuario_cupom"
  ON usuario_cupom FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE usuario_cupom IS 'Cupons da cidade que o usuário pegou; validade 30 dias a partir da data que pegou.';
