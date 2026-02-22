-- Rode 1º no Supabase (SQL Editor). Tabela de solicitações de orçamento.
CREATE TABLE IF NOT EXISTS solicitacao_orcamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id UUID NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'outros',
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_atendimento', 'fechado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitacao_orcamento_cidade ON solicitacao_orcamento(cidade_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_orcamento_user ON solicitacao_orcamento(user_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_orcamento_categoria ON solicitacao_orcamento(categoria);
CREATE INDEX IF NOT EXISTS idx_solicitacao_orcamento_created ON solicitacao_orcamento(created_at DESC);

ALTER TABLE solicitacao_orcamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own solicitacao" ON solicitacao_orcamento;
CREATE POLICY "Users can insert own solicitacao"
  ON solicitacao_orcamento FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own solicitacoes" ON solicitacao_orcamento;
CREATE POLICY "Users can view own solicitacoes"
  ON solicitacao_orcamento FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE solicitacao_orcamento IS 'Solicitações de orçamento do cidadão.';
