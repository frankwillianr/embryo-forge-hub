-- Rode 8º. View pública de cupons (sem o código, para anônimos verem a lista).
CREATE OR REPLACE VIEW cupom_public
  WITH (security_invoker = false)
AS
  SELECT id, cidade_id, titulo, descricao, codigo_censurado, checkins_necessarios, ativo, created_at
  FROM cupom WHERE ativo = true;

GRANT SELECT ON cupom_public TO anon;
GRANT SELECT ON cupom_public TO authenticated;
