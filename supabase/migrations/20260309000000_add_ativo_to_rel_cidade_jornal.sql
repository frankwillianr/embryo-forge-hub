-- Adiciona coluna ativo na tabela rel_cidade_jornal
-- Notícias nascem ativas por padrão
ALTER TABLE rel_cidade_jornal
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true;
