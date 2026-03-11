-- Integração Asaas para pagamento de empresas
ALTER TABLE public.rel_cidade_servico_empresa
  ADD COLUMN IF NOT EXISTS asaas_payment_link_id text,
  ADD COLUMN IF NOT EXISTS asaas_payment_url text,
  ADD COLUMN IF NOT EXISTS asaas_payment_value numeric(10,2),
  ADD COLUMN IF NOT EXISTS asaas_payment_status text,
  ADD COLUMN IF NOT EXISTS asaas_payment_id text,
  ADD COLUMN IF NOT EXISTS asaas_paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS asaas_last_event text,
  ADD COLUMN IF NOT EXISTS asaas_external_reference text;

COMMENT ON COLUMN public.rel_cidade_servico_empresa.asaas_payment_link_id IS 'ID do link de pagamento no Asaas';
COMMENT ON COLUMN public.rel_cidade_servico_empresa.asaas_payment_url IS 'URL pública de pagamento no Asaas';
COMMENT ON COLUMN public.rel_cidade_servico_empresa.asaas_payment_value IS 'Valor da cobrança da empresa no Asaas';
COMMENT ON COLUMN public.rel_cidade_servico_empresa.asaas_payment_status IS 'Status da cobrança no Asaas (PENDING, RECEIVED, CONFIRMED...)';
COMMENT ON COLUMN public.rel_cidade_servico_empresa.asaas_payment_id IS 'ID da cobrança/pagamento no Asaas';
COMMENT ON COLUMN public.rel_cidade_servico_empresa.asaas_paid_at IS 'Data/hora de confirmação de pagamento no Asaas';
COMMENT ON COLUMN public.rel_cidade_servico_empresa.asaas_last_event IS 'Último evento de webhook recebido do Asaas';
COMMENT ON COLUMN public.rel_cidade_servico_empresa.asaas_external_reference IS 'Referência externa enviada ao Asaas para reconciliação';
