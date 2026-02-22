-- Rode 4º. Nome censurado no card + todos podem listar orçamentos da cidade (home).
ALTER TABLE solicitacao_orcamento
  ADD COLUMN IF NOT EXISTS nome_solicitante_censurado TEXT;

DROP POLICY IF EXISTS "Anyone can list solicitacoes by city" ON solicitacao_orcamento;
CREATE POLICY "Anyone can list solicitacoes by city"
  ON solicitacao_orcamento FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated can list all solicitacoes" ON solicitacao_orcamento;
CREATE POLICY "Authenticated can list all solicitacoes"
  ON solicitacao_orcamento FOR SELECT TO authenticated
  USING (true);
