-- =============================================================================
-- Seed: 6 solicitações de orçamento bem montadas
-- Bairros: Vila Isa, Grã Duquesa, Centro, Centro, São Pedro, Castanheiras
-- Usuários criadores: aleatórios da tabela profiles (um por linha; pode repetir se houver poucos usuários)
-- Execute no Supabase SQL Editor. Requer: tabela cidade com ao menos 1 linha
-- e tabela profiles com ao menos 1 usuário.
-- =============================================================================

WITH
uma_cidade AS (
  SELECT id AS cidade_id FROM cidade LIMIT 1
),
dados AS (
  SELECT 1 AS rn, 'Vila Isa'::text     AS bairro, 'eletricista'::text AS categoria, 'Preciso de instalação de chuveiro elétrico e tomadas no banheiro. Apartamento já com ponto.'::text AS descricao
  UNION ALL SELECT 2, 'Grã Duquesa',   'encanador', 'Vazamento na cozinha sob a pia e torneira da lavanderia. Quero orçamento para reparo e se possível troca de registro.'
  UNION ALL SELECT 3, 'Centro',        'pintor',    'Pintura interna: sala e dois quartos, parede lisa. Preferência por tinta lavável. Área ~45 m².'
  UNION ALL SELECT 4, 'Centro',        'reparos',  'Troca de fechadura da porta de entrada e ajuste de porta do quarto que não fecha direito.'
  UNION ALL SELECT 5, 'São Pedro',     'limpeza',  'Limpeza pós-obra em apartamento de 80 m². Incluir limpeza de janelas e pisos.'
  UNION ALL SELECT 6, 'Castanheiras',  'obras',    'Reforma completa do banheiro: quebra de revestimento, novo piso e azulejo, troca de louça e box.'
)
INSERT INTO solicitacao_orcamento (
  cidade_id,
  user_id,
  categoria,
  descricao,
  status,
  bairro,
  nome_solicitante_censurado,
  cep,
  data_prevista,
  created_at
)
SELECT
  c.cidade_id,
  u.uid,
  d.categoria,
  d.descricao,
  'novo',
  d.bairro,
  u.iniciais,
  CASE (d.rn % 3) WHEN 0 THEN '01310100' WHEN 1 THEN '01310200' ELSE NULL END,
  CURRENT_DATE + (7 + (d.rn * 2)::int % 14),
  now() - (d.rn || ' days')::interval
FROM dados d
CROSS JOIN uma_cidade c
CROSS JOIN LATERAL (
  SELECT
    p.id AS uid,
    (LEFT(p.nome, 1) || '. ' || COALESCE(LEFT(TRIM(NULLIF(SPLIT_PART(p.nome, ' ', 2), '')), 1), '') || '.') AS iniciais
  FROM profiles p
  ORDER BY random()
  LIMIT 1
) u;
