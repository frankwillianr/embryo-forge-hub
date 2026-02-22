-- Cupom de desconto da empresa (opcional): nome, valor e tipo (real ou porcentagem)
ALTER TABLE rel_cidade_servico_empresa
  ADD COLUMN IF NOT EXISTS cupom_nome TEXT,
  ADD COLUMN IF NOT EXISTS cupom_valor NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS cupom_tipo TEXT CHECK (cupom_tipo IS NULL OR cupom_tipo IN ('real', 'porcentagem'));

COMMENT ON COLUMN rel_cidade_servico_empresa.cupom_nome IS 'Nome do cupom de desconto (ex: PRIMEIRACOMPRA)';
COMMENT ON COLUMN rel_cidade_servico_empresa.cupom_valor IS 'Valor do desconto: em reais (tipo real) ou percentual 0-100 (tipo porcentagem)';
COMMENT ON COLUMN rel_cidade_servico_empresa.cupom_tipo IS 'real = valor fixo em R$; porcentagem = desconto em %';
