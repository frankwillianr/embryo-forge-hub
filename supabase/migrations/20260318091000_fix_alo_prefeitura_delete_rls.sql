-- Permite exclusão de itens do Voz do Povo por usuários autenticados (fluxo admin)
-- e de imagens relacionadas.

ALTER TABLE IF EXISTS public.rel_cidade_alo_prefeitura ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.rel_cidade_alo_prefeitura_imagens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Alo prefeitura delete authenticated" ON public.rel_cidade_alo_prefeitura;
CREATE POLICY "Alo prefeitura delete authenticated"
  ON public.rel_cidade_alo_prefeitura
  FOR DELETE
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Alo prefeitura imagens delete authenticated" ON public.rel_cidade_alo_prefeitura_imagens;
CREATE POLICY "Alo prefeitura imagens delete authenticated"
  ON public.rel_cidade_alo_prefeitura_imagens
  FOR DELETE
  TO authenticated
  USING (true);
