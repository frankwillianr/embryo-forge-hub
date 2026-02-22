-- Check-in diário por cidade (1 por usuário por dia por cidade)
CREATE TABLE IF NOT EXISTS checkin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cidade_id UUID NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT (current_date AT TIME ZONE 'America/Sao_Paulo'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, cidade_id, data)
);

CREATE INDEX IF NOT EXISTS idx_checkin_user_cidade ON checkin(user_id, cidade_id);
CREATE INDEX IF NOT EXISTS idx_checkin_data ON checkin(data DESC);

ALTER TABLE checkin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own checkin" ON checkin;
CREATE POLICY "Users can insert own checkin"
  ON checkin FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own checkins" ON checkin;
CREATE POLICY "Users can view own checkins"
  ON checkin FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Cupons de desconto (desbloqueados com N check-ins consecutivos)
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

-- Autenticados veem cupom completo (código só é exibido no app quando desbloqueado)
DROP POLICY IF EXISTS "Anyone can view cupom list" ON cupom;
DROP POLICY IF EXISTS "Authenticated can view cupom" ON cupom;
CREATE POLICY "Authenticated can view cupom"
  ON cupom FOR SELECT TO authenticated
  USING (ativo = true);

-- View pública para listar cupons sem o código (anon vê lista; app mostra censurado)
-- SECURITY DEFINER para que a leitura rode como owner e anon consiga listar
CREATE OR REPLACE VIEW cupom_public
  WITH (security_invoker = false)
AS
  SELECT id, cidade_id, titulo, descricao, codigo_censurado, checkins_necessarios, ativo, created_at
  FROM cupom WHERE ativo = true;

GRANT SELECT ON cupom_public TO anon;
GRANT SELECT ON cupom_public TO authenticated;

COMMENT ON TABLE checkin IS 'Check-in diário do usuário na cidade; usado para sequência consecutiva e desbloqueio de cupons.';
COMMENT ON TABLE cupom IS 'Cupons de desconto; código revelado após checkins_necessarios dias consecutivos de check-in.';
