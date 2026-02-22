-- Categoria opcional no cupom para filtro na listagem "Ver todos"
ALTER TABLE cupom
  ADD COLUMN IF NOT EXISTS categoria TEXT;

COMMENT ON COLUMN cupom.categoria IS 'Categoria do cupom (ex: eletricista, salao) para filtro na listagem; opcional.';

-- Atualizar a view pública para incluir categoria
CREATE OR REPLACE VIEW cupom_public
  WITH (security_invoker = false)
AS
  SELECT id, cidade_id, titulo, descricao, codigo_censurado, checkins_necessarios, ativo, created_at, categoria
  FROM cupom WHERE ativo = true;
