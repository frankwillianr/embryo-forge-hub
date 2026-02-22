-- Bairro separado para exibir no card (apenas bairro, sem endereço completo)
ALTER TABLE solicitacao_orcamento
  ADD COLUMN IF NOT EXISTS bairro TEXT;

COMMENT ON COLUMN solicitacao_orcamento.bairro IS 'Bairro onde o serviço será realizado (exibido no card).';
