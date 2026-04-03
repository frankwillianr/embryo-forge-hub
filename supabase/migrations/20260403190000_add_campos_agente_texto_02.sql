-- Campos para saída do Agente Texto 02 (reescrita de notícias do buscador)
ALTER TABLE public.tabela_agente_buscador
  ADD COLUMN IF NOT EXISTS titulo_original TEXT,
  ADD COLUMN IF NOT EXISTS descricao_original TEXT,
  ADD COLUMN IF NOT EXISTS titulo_reescrito TEXT,
  ADD COLUMN IF NOT EXISTS descricao_reescrita TEXT,
  ADD COLUMN IF NOT EXISTS texto_reescrito TEXT,
  ADD COLUMN IF NOT EXISTS agente_texto_updated_at TIMESTAMPTZ;

