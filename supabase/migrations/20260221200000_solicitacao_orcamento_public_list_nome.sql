-- Nome censurado na própria linha (para listar na home sem join em profiles)
ALTER TABLE solicitacao_orcamento
  ADD COLUMN IF NOT EXISTS nome_solicitante_censurado TEXT;

COMMENT ON COLUMN solicitacao_orcamento.nome_solicitante_censurado IS 'Iniciais do solicitante (ex: F. S.) para exibição na listagem pública.';

-- Qualquer pessoa (anon ou authenticated) pode LISTAR todas as solicitações da cidade (home)
DROP POLICY IF EXISTS "Users can view own solicitacoes" ON solicitacao_orcamento;
CREATE POLICY "Users can view own solicitacoes"
  ON solicitacao_orcamento FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Anyone can list solicitacoes by city" ON solicitacao_orcamento;
CREATE POLICY "Anyone can list solicitacoes by city"
  ON solicitacao_orcamento FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated can list all solicitacoes" ON solicitacao_orcamento;
CREATE POLICY "Authenticated can list all solicitacoes"
  ON solicitacao_orcamento FOR SELECT TO authenticated
  USING (true);
