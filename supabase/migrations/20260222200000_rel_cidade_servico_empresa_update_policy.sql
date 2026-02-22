-- Permite que o dono da empresa atualize sua própria linha em rel_cidade_servico_empresa
-- (necessário para Editar Empresa salvar)

ALTER TABLE rel_cidade_servico_empresa ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can update own empresa" ON rel_cidade_servico_empresa;
CREATE POLICY "Users can update own empresa"
  ON rel_cidade_servico_empresa FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
