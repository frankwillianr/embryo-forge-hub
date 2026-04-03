-- Campos para rastrear publicação no Jornal da Cidade pelo Agente 05
ALTER TABLE public.tabela_agente_buscador
  ADD COLUMN IF NOT EXISTS jornal_post_id UUID,
  ADD COLUMN IF NOT EXISTS jornal_postado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS jornal_post_erro TEXT;

CREATE INDEX IF NOT EXISTS idx_tabela_agente_buscador_jornal_postado
  ON public.tabela_agente_buscador (cidade_id, status, jornal_postado_at);
