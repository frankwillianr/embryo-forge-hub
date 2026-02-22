-- Conversa: um profissional (user_id) responde a uma solicitação (solicitacao_id)
-- Uma conversa por par (solicitacao_id, user_id do profissional)
CREATE TABLE IF NOT EXISTS solicitacao_orcamento_conversa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES solicitacao_orcamento(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(solicitacao_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_orcamento_conversa_solicitacao ON solicitacao_orcamento_conversa(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_conversa_user ON solicitacao_orcamento_conversa(user_id);

-- Mensagens do chat dentro da conversa
CREATE TABLE IF NOT EXISTS solicitacao_orcamento_mensagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES solicitacao_orcamento_conversa(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orcamento_mensagem_conversa ON solicitacao_orcamento_mensagem(conversa_id);

-- RLS conversa
ALTER TABLE solicitacao_orcamento_conversa ENABLE ROW LEVEL SECURITY;

-- Ver conversa: dono da solicitação ou o profissional da conversa
CREATE POLICY "View conversa as participant"
  ON solicitacao_orcamento_conversa FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM solicitacao_orcamento so
      WHERE so.id = solicitacao_orcamento_conversa.solicitacao_id AND so.user_id = auth.uid()
    )
  );

-- Criar conversa: apenas se for o próprio usuário (profissional)
CREATE POLICY "Insert own conversa"
  ON solicitacao_orcamento_conversa FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Atualizar updated_at (opcional, para "última atividade")
CREATE POLICY "Update own conversa"
  ON solicitacao_orcamento_conversa FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS mensagem
ALTER TABLE solicitacao_orcamento_mensagem ENABLE ROW LEVEL SECURITY;

-- Ver mensagens: quem participa da conversa
CREATE POLICY "View messages as participant"
  ON solicitacao_orcamento_mensagem FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM solicitacao_orcamento_conversa c
      JOIN solicitacao_orcamento so ON so.id = c.solicitacao_id
      WHERE c.id = solicitacao_orcamento_mensagem.conversa_id
        AND (c.user_id = auth.uid() OR so.user_id = auth.uid())
    )
  );

-- Enviar mensagem: quem participa da conversa
CREATE POLICY "Insert message as participant"
  ON solicitacao_orcamento_mensagem FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM solicitacao_orcamento_conversa c
      JOIN solicitacao_orcamento so ON so.id = c.solicitacao_id
      WHERE c.id = conversa_id
        AND (c.user_id = auth.uid() OR so.user_id = auth.uid())
    )
  );

-- Trigger para atualizar updated_at na conversa
CREATE OR REPLACE FUNCTION set_orcamento_conversa_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE solicitacao_orcamento_conversa
  SET updated_at = now()
  WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_orcamento_mensagem_updated ON solicitacao_orcamento_mensagem;
CREATE TRIGGER trg_orcamento_mensagem_updated
  AFTER INSERT ON solicitacao_orcamento_mensagem
  FOR EACH ROW EXECUTE FUNCTION set_orcamento_conversa_updated_at();
