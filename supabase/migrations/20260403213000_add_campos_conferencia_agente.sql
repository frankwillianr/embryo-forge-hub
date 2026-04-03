-- Campos para conferencia e deduplicacao de noticias
ALTER TABLE public.tabela_agente_buscador
  ADD COLUMN IF NOT EXISTS is_duplicada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS noticia_canonica_id UUID NULL REFERENCES public.tabela_agente_buscador(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS conferencia_score NUMERIC(6,4),
  ADD COLUMN IF NOT EXISTS conferencia_motivo TEXT,
  ADD COLUMN IF NOT EXISTS conferencia_updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tabela_agente_buscador_cidade_duplicada
  ON public.tabela_agente_buscador (cidade_id, is_duplicada);

CREATE INDEX IF NOT EXISTS idx_tabela_agente_buscador_canonica
  ON public.tabela_agente_buscador (noticia_canonica_id);
