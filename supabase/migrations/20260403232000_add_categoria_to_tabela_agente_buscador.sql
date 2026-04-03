-- Categoria definida pelo Agente de Texto
ALTER TABLE public.tabela_agente_buscador
  ADD COLUMN IF NOT EXISTS categoria TEXT;

CREATE INDEX IF NOT EXISTS idx_tabela_agente_buscador_categoria
  ON public.tabela_agente_buscador (cidade_id, categoria);
