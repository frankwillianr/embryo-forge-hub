-- Campos para saída do Agente Imagem 04
ALTER TABLE public.tabela_agente_buscador
  ADD COLUMN IF NOT EXISTS imagem_refeita TEXT,
  ADD COLUMN IF NOT EXISTS agente_imagem_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tabela_agente_buscador_imagem_refeita
  ON public.tabela_agente_buscador (cidade_id, imagem_refeita);
