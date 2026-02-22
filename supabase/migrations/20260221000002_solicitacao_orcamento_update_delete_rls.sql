-- RLS: usuário pode atualizar e deletar apenas suas próprias solicitações

DROP POLICY IF EXISTS "Users can update own solicitacao" ON solicitacao_orcamento;
CREATE POLICY "Users can update own solicitacao"
  ON solicitacao_orcamento FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own solicitacao" ON solicitacao_orcamento;
CREATE POLICY "Users can delete own solicitacao"
  ON solicitacao_orcamento FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
