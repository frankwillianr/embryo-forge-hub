-- Permite até 2 categorias adicionais (total 3 com a principal)
ALTER TABLE rel_cidade_servico_empresa
  ADD COLUMN IF NOT EXISTS categorias_adicionais TEXT[] DEFAULT '{}';

COMMENT ON COLUMN rel_cidade_servico_empresa.categorias_adicionais IS 'Até 2 categorias extras; a empresa aparece na listagem dessas categorias além da principal (categoria).';
