-- Campos extras na solicitação de orçamento (estilo GetNinjas: CEP, endereço, data prevista)
-- Execute no Supabase Dashboard > SQL Editor

ALTER TABLE solicitacao_orcamento
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS endereco_complemento TEXT,
  ADD COLUMN IF NOT EXISTS data_prevista DATE;

COMMENT ON COLUMN solicitacao_orcamento.cep IS 'CEP onde o serviço será realizado (para profissionais próximos)';
COMMENT ON COLUMN solicitacao_orcamento.endereco_complemento IS 'Número, bairro ou referência (opcional)';
COMMENT ON COLUMN solicitacao_orcamento.data_prevista IS 'Data aproximada em que o cliente precisa do serviço';
