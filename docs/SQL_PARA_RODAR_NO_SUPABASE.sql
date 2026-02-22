-- =============================================================================
-- SCRIPT ÚNICO (tudo junto). Se preferir rodar UM SQL por vez, use a pasta:
--   docs/sql/   (arquivos 01, 02, 03... na ordem)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1) TABELA solicitacao_orcamento (solicitar orçamento, minhas solicitações)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitacao_orcamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id UUID NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria TEXT NOT NULL DEFAULT 'outros',
  descricao TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'novo' CHECK (status IN ('novo', 'em_atendimento', 'fechado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_solicitacao_orcamento_cidade ON solicitacao_orcamento(cidade_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_orcamento_user ON solicitacao_orcamento(user_id);
CREATE INDEX IF NOT EXISTS idx_solicitacao_orcamento_categoria ON solicitacao_orcamento(categoria);
CREATE INDEX IF NOT EXISTS idx_solicitacao_orcamento_created ON solicitacao_orcamento(created_at DESC);

ALTER TABLE solicitacao_orcamento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own solicitacao" ON solicitacao_orcamento;
CREATE POLICY "Users can insert own solicitacao"
  ON solicitacao_orcamento FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own solicitacoes" ON solicitacao_orcamento;
CREATE POLICY "Users can view own solicitacoes"
  ON solicitacao_orcamento FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE solicitacao_orcamento IS 'Solicitações de orçamento do cidadão.';


-- -----------------------------------------------------------------------------
-- 2) CAMPOS EXTRAS em solicitacao_orcamento (CEP, endereço, data prevista)
-- -----------------------------------------------------------------------------
ALTER TABLE solicitacao_orcamento
  ADD COLUMN IF NOT EXISTS cep TEXT,
  ADD COLUMN IF NOT EXISTS endereco_complemento TEXT,
  ADD COLUMN IF NOT EXISTS data_prevista DATE;

COMMENT ON COLUMN solicitacao_orcamento.cep IS 'CEP onde o serviço será realizado';
COMMENT ON COLUMN solicitacao_orcamento.endereco_complemento IS 'Número, bairro ou referência (opcional)';
COMMENT ON COLUMN solicitacao_orcamento.data_prevista IS 'Data aproximada em que o cliente precisa do serviço';


-- -----------------------------------------------------------------------------
-- 3) RLS: usuário pode ATUALIZAR e DELETAR suas próprias solicitações
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can update own solicitacao" ON solicitacao_orcamento;
CREATE POLICY "Users can update own solicitacao"
  ON solicitacao_orcamento FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own solicitacao" ON solicitacao_orcamento;
CREATE POLICY "Users can delete own solicitacao"
  ON solicitacao_orcamento FOR DELETE TO authenticated
  USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 3b) Nome censurado na solicitação + listagem pública na home (todos veem todos)
-- -----------------------------------------------------------------------------
ALTER TABLE solicitacao_orcamento
  ADD COLUMN IF NOT EXISTS nome_solicitante_censurado TEXT;

DROP POLICY IF EXISTS "Anyone can list solicitacoes by city" ON solicitacao_orcamento;
CREATE POLICY "Anyone can list solicitacoes by city"
  ON solicitacao_orcamento FOR SELECT TO anon
  USING (true);

DROP POLICY IF EXISTS "Authenticated can list all solicitacoes" ON solicitacao_orcamento;
CREATE POLICY "Authenticated can list all solicitacoes"
  ON solicitacao_orcamento FOR SELECT TO authenticated
  USING (true);


-- -----------------------------------------------------------------------------
-- 3c) Bairro na solicitação (exibido no card)
-- -----------------------------------------------------------------------------
ALTER TABLE solicitacao_orcamento
  ADD COLUMN IF NOT EXISTS bairro TEXT;


-- -----------------------------------------------------------------------------
-- 4) TABELA checkin (check-in diário por cidade)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS checkin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cidade_id UUID NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  data DATE NOT NULL DEFAULT (current_date AT TIME ZONE 'America/Sao_Paulo'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, cidade_id, data)
);

CREATE INDEX IF NOT EXISTS idx_checkin_user_cidade ON checkin(user_id, cidade_id);
CREATE INDEX IF NOT EXISTS idx_checkin_data ON checkin(data DESC);

ALTER TABLE checkin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can insert own checkin" ON checkin;
CREATE POLICY "Users can insert own checkin"
  ON checkin FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own checkins" ON checkin;
CREATE POLICY "Users can view own checkins"
  ON checkin FOR SELECT TO authenticated
  USING (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- 5) TABELA cupom + view pública
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cupom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id UUID NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  descricao TEXT,
  codigo TEXT NOT NULL,
  codigo_censurado TEXT NOT NULL,
  checkins_necessarios INT NOT NULL DEFAULT 7,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cupom_cidade ON cupom(cidade_id);
CREATE INDEX IF NOT EXISTS idx_cupom_ativo ON cupom(ativo) WHERE ativo = true;

ALTER TABLE cupom ADD COLUMN IF NOT EXISTS categoria TEXT;

ALTER TABLE cupom ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view cupom list" ON cupom;
DROP POLICY IF EXISTS "Authenticated can view cupom" ON cupom;
CREATE POLICY "Authenticated can view cupom"
  ON cupom FOR SELECT TO authenticated
  USING (ativo = true);

-- View sempre com as mesmas colunas (incluindo categoria) para evitar erro "cannot drop columns from view" ao reexecutar
CREATE OR REPLACE VIEW cupom_public
  WITH (security_invoker = false)
AS
  SELECT id, cidade_id, titulo, descricao, codigo_censurado, checkins_necessarios, ativo, created_at, categoria
  FROM cupom WHERE ativo = true;

GRANT SELECT ON cupom_public TO anon;
GRANT SELECT ON cupom_public TO authenticated;

COMMENT ON TABLE checkin IS 'Check-in diário; 7 consecutivos desbloqueiam cupons.';
COMMENT ON TABLE cupom IS 'Cupons de desconto; código revelado após checkins_necessarios dias.';

-- CPF no perfil (proteção no cupom ao pegar)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS cpf TEXT;
COMMENT ON COLUMN profiles.cpf IS 'CPF exibido no cupom como proteção contra print/screenshot.';

-- Cupom pego pelo usuário (status pego + validade 30 dias)
CREATE TABLE IF NOT EXISTS usuario_cupom (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cupom_id UUID NOT NULL REFERENCES cupom(id) ON DELETE CASCADE,
  cidade_id UUID NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  validade DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, cupom_id)
);
CREATE INDEX IF NOT EXISTS idx_usuario_cupom_user ON usuario_cupom(user_id);
CREATE INDEX IF NOT EXISTS idx_usuario_cupom_validade ON usuario_cupom(validade);
ALTER TABLE usuario_cupom ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own usuario_cupom" ON usuario_cupom;
CREATE POLICY "Users can insert own usuario_cupom" ON usuario_cupom FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own usuario_cupom" ON usuario_cupom;
CREATE POLICY "Users can view own usuario_cupom" ON usuario_cupom FOR SELECT TO authenticated USING (auth.uid() = user_id);
COMMENT ON TABLE usuario_cupom IS 'Cupons que o usuário pegou; validade 30 dias.';

-- Cupom de empresa pego pelo usuário (Meus cupons)
CREATE TABLE IF NOT EXISTS usuario_cupom_empresa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id UUID NOT NULL REFERENCES rel_cidade_servico_empresa(id) ON DELETE CASCADE,
  cidade_id UUID NOT NULL REFERENCES cidade(id) ON DELETE CASCADE,
  validade DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, empresa_id)
);
CREATE INDEX IF NOT EXISTS idx_usuario_cupom_empresa_user ON usuario_cupom_empresa(user_id);
CREATE INDEX IF NOT EXISTS idx_usuario_cupom_empresa_validade ON usuario_cupom_empresa(validade);
ALTER TABLE usuario_cupom_empresa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can insert own usuario_cupom_empresa" ON usuario_cupom_empresa;
CREATE POLICY "Users can insert own usuario_cupom_empresa" ON usuario_cupom_empresa FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can view own usuario_cupom_empresa" ON usuario_cupom_empresa;
CREATE POLICY "Users can view own usuario_cupom_empresa" ON usuario_cupom_empresa FOR SELECT TO authenticated USING (auth.uid() = user_id);
COMMENT ON TABLE usuario_cupom_empresa IS 'Cupons de empresa que o usuário pegou; validade 30 dias.';


-- -----------------------------------------------------------------------------
-- OPCIONAL: Inserir um cupom de exemplo (troque 'UUID-DA-CIDADE' pelo id da cidade)
-- -----------------------------------------------------------------------------
-- INSERT INTO cupom (cidade_id, titulo, descricao, codigo, codigo_censurado, checkins_necessarios, ativo)
-- VALUES (
--   'UUID-DA-CIDADE',
--   '10% no primeiro pedido',
--   'Válido em parceiros da cidade',
--   'BEMVINDO10',
--   '••••••••10',
--   7,
--   true
-- );


-- -----------------------------------------------------------------------------
-- Conversa e chat para "Enviar orçamento" (um profissional por solicitação)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitacao_orcamento_conversa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  solicitacao_id UUID NOT NULL REFERENCES solicitacao_orcamento(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(solicitacao_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_orcamento_conversa_solicitacao ON solicitacao_orcamento_conversa(solicitacao_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_conversa_user ON solicitacao_orcamento_conversa(user_id);

ALTER TABLE solicitacao_orcamento_conversa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View conversa as participant" ON solicitacao_orcamento_conversa;
CREATE POLICY "View conversa as participant"
  ON solicitacao_orcamento_conversa FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR EXISTS (SELECT 1 FROM solicitacao_orcamento so WHERE so.id = solicitacao_orcamento_conversa.solicitacao_id AND so.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "Insert own conversa" ON solicitacao_orcamento_conversa;
CREATE POLICY "Insert own conversa" ON solicitacao_orcamento_conversa FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Update own conversa" ON solicitacao_orcamento_conversa;
CREATE POLICY "Update own conversa" ON solicitacao_orcamento_conversa FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS solicitacao_orcamento_mensagem (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id UUID NOT NULL REFERENCES solicitacao_orcamento_conversa(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_orcamento_mensagem_conversa ON solicitacao_orcamento_mensagem(conversa_id);

ALTER TABLE solicitacao_orcamento_mensagem ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "View messages as participant" ON solicitacao_orcamento_mensagem;
CREATE POLICY "View messages as participant" ON solicitacao_orcamento_mensagem FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM solicitacao_orcamento_conversa c
    JOIN solicitacao_orcamento so ON so.id = c.solicitacao_id
    WHERE c.id = solicitacao_orcamento_mensagem.conversa_id AND (c.user_id = auth.uid() OR so.user_id = auth.uid())
  ));
DROP POLICY IF EXISTS "Insert message as participant" ON solicitacao_orcamento_mensagem;
CREATE POLICY "Insert message as participant" ON solicitacao_orcamento_mensagem FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND EXISTS (
    SELECT 1 FROM solicitacao_orcamento_conversa c
    JOIN solicitacao_orcamento so ON so.id = c.solicitacao_id
    WHERE c.id = conversa_id AND (c.user_id = auth.uid() OR so.user_id = auth.uid())
  ));

CREATE OR REPLACE FUNCTION set_orcamento_conversa_updated_at() RETURNS TRIGGER AS $$
BEGIN
  UPDATE solicitacao_orcamento_conversa SET updated_at = now() WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_orcamento_mensagem_updated ON solicitacao_orcamento_mensagem;
CREATE TRIGGER trg_orcamento_mensagem_updated AFTER INSERT ON solicitacao_orcamento_mensagem
  FOR EACH ROW EXECUTE FUNCTION set_orcamento_conversa_updated_at();


-- -----------------------------------------------------------------------------
-- Empresa: até 2 categorias adicionais (total 3 com a principal)
-- -----------------------------------------------------------------------------
ALTER TABLE rel_cidade_servico_empresa
  ADD COLUMN IF NOT EXISTS categorias_adicionais TEXT[] DEFAULT '{}';

COMMENT ON COLUMN rel_cidade_servico_empresa.categorias_adicionais IS 'Até 2 categorias extras; a empresa aparece na listagem dessas categorias além da principal (categoria).';

-- Cupom de desconto da empresa (opcional)
ALTER TABLE rel_cidade_servico_empresa
  ADD COLUMN IF NOT EXISTS cupom_nome TEXT,
  ADD COLUMN IF NOT EXISTS cupom_valor NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS cupom_tipo TEXT CHECK (cupom_tipo IS NULL OR cupom_tipo IN ('real', 'porcentagem'));

-- Lat/long para exibir empresas no mapa (pins)
ALTER TABLE rel_cidade_servico_empresa
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
COMMENT ON COLUMN rel_cidade_servico_empresa.latitude IS 'Latitude para exibir a empresa no mapa';
COMMENT ON COLUMN rel_cidade_servico_empresa.longitude IS 'Longitude para exibir a empresa no mapa';

-- Logomarca da empresa (URL da imagem)
ALTER TABLE rel_cidade_servico_empresa
  ADD COLUMN IF NOT EXISTS logomarca_url TEXT;
COMMENT ON COLUMN rel_cidade_servico_empresa.logomarca_url IS 'URL da logomarca da empresa (upload opcional)';

-- Policy para poder EDITAR a empresa (salvar alterações)
ALTER TABLE rel_cidade_servico_empresa ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can update own empresa" ON rel_cidade_servico_empresa;
CREATE POLICY "Users can update own empresa"
  ON rel_cidade_servico_empresa FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- -----------------------------------------------------------------------------
-- Contagem de orçamentos "não lidos" (última mensagem foi do outro) — badges na home
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_orcamento_unread_counts(p_user_id UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH last_msgs AS (
    SELECT DISTINCT ON (conversa_id) conversa_id, user_id AS last_sender_id
    FROM solicitacao_orcamento_mensagem
    ORDER BY conversa_id, created_at DESC
  ),
  conv_with_sol AS (
    SELECT c.id AS conversa_id, c.user_id AS profissional_id, so.user_id AS solicitante_id
    FROM solicitacao_orcamento_conversa c
    JOIN solicitacao_orcamento so ON so.id = c.solicitacao_id
  )
  SELECT json_build_object(
    'recebidos', COALESCE((
      SELECT COUNT(*)::int
      FROM conv_with_sol c
      JOIN last_msgs lm ON lm.conversa_id = c.conversa_id
      WHERE c.solicitante_id = p_user_id AND lm.last_sender_id != p_user_id
    ), 0),
    'enviados', COALESCE((
      SELECT COUNT(*)::int
      FROM conv_with_sol c
      JOIN last_msgs lm ON lm.conversa_id = c.conversa_id
      WHERE c.profissional_id = p_user_id AND lm.last_sender_id != p_user_id
    ), 0)
  );
$$;
GRANT EXECUTE ON FUNCTION get_orcamento_unread_counts(UUID) TO authenticated;


-- -----------------------------------------------------------------------------
-- Cupom: coluna categoria para filtro na listagem "Ver todos"
-- -----------------------------------------------------------------------------
ALTER TABLE cupom ADD COLUMN IF NOT EXISTS categoria TEXT;
CREATE OR REPLACE VIEW cupom_public WITH (security_invoker = false) AS
  SELECT id, cidade_id, titulo, descricao, codigo_censurado, checkins_necessarios, ativo, created_at, categoria
  FROM cupom WHERE ativo = true;


-- -----------------------------------------------------------------------------
-- Realtime: mensagens do chat de orçamento em tempo real
-- -----------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'solicitacao_orcamento_mensagem'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE solicitacao_orcamento_mensagem;
  END IF;
END $$;


-- -----------------------------------------------------------------------------
-- Leitura por participante (checkmarks "visualizado" no chat)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS solicitacao_orcamento_conversa_leitura (
  conversa_id UUID NOT NULL REFERENCES solicitacao_orcamento_conversa(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (conversa_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_orcamento_leitura_conversa ON solicitacao_orcamento_conversa_leitura(conversa_id);
ALTER TABLE solicitacao_orcamento_conversa_leitura ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read as participant" ON solicitacao_orcamento_conversa_leitura;
CREATE POLICY "Read as participant" ON solicitacao_orcamento_conversa_leitura FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM solicitacao_orcamento_conversa c JOIN solicitacao_orcamento so ON so.id = c.solicitacao_id WHERE c.id = conversa_id AND (c.user_id = auth.uid() OR so.user_id = auth.uid())));
DROP POLICY IF EXISTS "Insert own read" ON solicitacao_orcamento_conversa_leitura;
CREATE POLICY "Insert own read" ON solicitacao_orcamento_conversa_leitura FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Update own read" ON solicitacao_orcamento_conversa_leitura;
CREATE POLICY "Update own read" ON solicitacao_orcamento_conversa_leitura FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'solicitacao_orcamento_conversa_leitura') THEN ALTER PUBLICATION supabase_realtime ADD TABLE solicitacao_orcamento_conversa_leitura; END IF; END $$;
