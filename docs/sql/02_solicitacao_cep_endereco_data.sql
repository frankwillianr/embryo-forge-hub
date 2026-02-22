-- Rode 2º. Campos CEP, endereço e data prevista na solicitação.
ALTER TABLE solicitacao_orcamento
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS endereco_complemento TEXT,
  ADD COLUMN IF NOT EXISTS data_prevista DATE;

COMMENT ON COLUMN solicitacao_orcamento.cep IS 'CEP onde o serviço será realizado';
COMMENT ON COLUMN solicitacao_orcamento.endereco_complemento IS 'Endereço completo (opcional)';
COMMENT ON COLUMN solicitacao_orcamento.data_prevista IS 'Data em que o cliente precisa do serviço';
