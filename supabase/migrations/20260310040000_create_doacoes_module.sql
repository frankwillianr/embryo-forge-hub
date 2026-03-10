-- Modulo Doacoes (separado do Desapega)
-- Estrutura vinculada a cidade e sem campo de preco.

CREATE TABLE IF NOT EXISTS rel_cidade_doacao_categoria (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  icone TEXT DEFAULT '🎁',
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rel_cidade_doacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id UUID NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  categoria_id UUID REFERENCES rel_cidade_doacao_categoria(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT,
  condicao TEXT NOT NULL DEFAULT 'usado' CHECK (condicao IN ('novo', 'seminovo', 'usado')),
  whatsapp TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo', 'removido')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS rel_cidade_doacao_imagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  anuncio_id UUID NOT NULL REFERENCES rel_cidade_doacao(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rel_cidade_doacao_cidade ON rel_cidade_doacao(cidade_id);
CREATE INDEX IF NOT EXISTS idx_rel_cidade_doacao_status ON rel_cidade_doacao(status);
CREATE INDEX IF NOT EXISTS idx_rel_cidade_doacao_categoria ON rel_cidade_doacao(categoria_id);
CREATE INDEX IF NOT EXISTS idx_rel_cidade_doacao_created_at ON rel_cidade_doacao(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rel_cidade_doacao_imagem_anuncio ON rel_cidade_doacao_imagem(anuncio_id);

INSERT INTO rel_cidade_doacao_categoria (nome, icone, ordem)
SELECT * FROM (
  VALUES
    ('Moveis', '🪑', 1),
    ('Eletrodomesticos', '🔌', 2),
    ('Roupas', '👕', 3),
    ('Infantil', '🧸', 4),
    ('Saude', '🩺', 5),
    ('Outros', '🎁', 99)
) AS v(nome, icone, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM rel_cidade_doacao_categoria c WHERE c.nome = v.nome
);

ALTER TABLE rel_cidade_doacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE rel_cidade_doacao_categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE rel_cidade_doacao_imagem ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Doacoes categoria public read" ON rel_cidade_doacao_categoria;
CREATE POLICY "Doacoes categoria public read"
  ON rel_cidade_doacao_categoria FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Doacoes public read active" ON rel_cidade_doacao;
CREATE POLICY "Doacoes public read active"
  ON rel_cidade_doacao FOR SELECT
  TO public
  USING (status = 'ativo');

DROP POLICY IF EXISTS "Doacoes public insert" ON rel_cidade_doacao;
CREATE POLICY "Doacoes public insert"
  ON rel_cidade_doacao FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Doacoes public update" ON rel_cidade_doacao;
CREATE POLICY "Doacoes public update"
  ON rel_cidade_doacao FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Doacoes public delete" ON rel_cidade_doacao;
CREATE POLICY "Doacoes public delete"
  ON rel_cidade_doacao FOR DELETE
  TO public
  USING (true);

DROP POLICY IF EXISTS "Doacoes imagem public read" ON rel_cidade_doacao_imagem;
CREATE POLICY "Doacoes imagem public read"
  ON rel_cidade_doacao_imagem FOR SELECT
  TO public
  USING (true);

DROP POLICY IF EXISTS "Doacoes imagem public insert" ON rel_cidade_doacao_imagem;
CREATE POLICY "Doacoes imagem public insert"
  ON rel_cidade_doacao_imagem FOR INSERT
  TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "Doacoes imagem public update" ON rel_cidade_doacao_imagem;
CREATE POLICY "Doacoes imagem public update"
  ON rel_cidade_doacao_imagem FOR UPDATE
  TO public
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "Doacoes imagem public delete" ON rel_cidade_doacao_imagem;
CREATE POLICY "Doacoes imagem public delete"
  ON rel_cidade_doacao_imagem FOR DELETE
  TO public
  USING (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('doacoes', 'doacoes', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Doacoes storage public read" ON storage.objects;
CREATE POLICY "Doacoes storage public read"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'doacoes');

DROP POLICY IF EXISTS "Doacoes storage public insert" ON storage.objects;
CREATE POLICY "Doacoes storage public insert"
  ON storage.objects FOR INSERT
  TO public
  WITH CHECK (bucket_id = 'doacoes');

DROP POLICY IF EXISTS "Doacoes storage public update" ON storage.objects;
CREATE POLICY "Doacoes storage public update"
  ON storage.objects FOR UPDATE
  TO public
  USING (bucket_id = 'doacoes')
  WITH CHECK (bucket_id = 'doacoes');

DROP POLICY IF EXISTS "Doacoes storage public delete" ON storage.objects;
CREATE POLICY "Doacoes storage public delete"
  ON storage.objects FOR DELETE
  TO public
  USING (bucket_id = 'doacoes');
