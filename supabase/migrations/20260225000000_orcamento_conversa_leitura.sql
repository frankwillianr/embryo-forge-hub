-- Rastreio de leitura por participante: quando cada um abriu a conversa pela última vez
CREATE TABLE IF NOT EXISTS solicitacao_orcamento_conversa_leitura (
  conversa_id UUID NOT NULL REFERENCES solicitacao_orcamento_conversa(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversa_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_orcamento_leitura_conversa ON solicitacao_orcamento_conversa_leitura(conversa_id);

ALTER TABLE solicitacao_orcamento_conversa_leitura ENABLE ROW LEVEL SECURITY;

-- Participantes da conversa podem ler as linhas de leitura (para saber se o outro viu)
CREATE POLICY "Read as participant"
  ON solicitacao_orcamento_conversa_leitura FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM solicitacao_orcamento_conversa c
      JOIN solicitacao_orcamento so ON so.id = c.solicitacao_id
      WHERE c.id = conversa_id AND (c.user_id = auth.uid() OR so.user_id = auth.uid())
    )
  );

-- Cada um insere/atualiza só a própria linha
CREATE POLICY "Insert own read"
  ON solicitacao_orcamento_conversa_leitura FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Update own read"
  ON solicitacao_orcamento_conversa_leitura FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Realtime para atualizar checkmarks quando o outro abre a conversa
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'solicitacao_orcamento_conversa_leitura'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE solicitacao_orcamento_conversa_leitura;
  END IF;
END $$;
