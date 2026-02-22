-- Logomarca da empresa (URL da imagem)
ALTER TABLE rel_cidade_servico_empresa
  ADD COLUMN IF NOT EXISTS logomarca_url TEXT;

COMMENT ON COLUMN rel_cidade_servico_empresa.logomarca_url IS 'URL da logomarca da empresa (upload opcional)';
