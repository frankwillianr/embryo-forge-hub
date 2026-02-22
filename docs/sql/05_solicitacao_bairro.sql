-- Rode 5º. Bairro na solicitação (mostrado no card).
ALTER TABLE solicitacao_orcamento
  ADD COLUMN IF NOT EXISTS bairro TEXT;
