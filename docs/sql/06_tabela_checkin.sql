-- Rode 6º. Tabela de check-in diário (7 dias = desbloqueia cupom).
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

COMMENT ON TABLE checkin IS 'Check-in diário; 7 consecutivos desbloqueiam cupons.';
