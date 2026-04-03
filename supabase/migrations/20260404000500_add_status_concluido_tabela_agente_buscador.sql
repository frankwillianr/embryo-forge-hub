-- Adiciona status final "concluido" para não reprocessar notícia já finalizada
ALTER TABLE public.tabela_agente_buscador
  DROP CONSTRAINT IF EXISTS tabela_agente_buscador_status_check;

ALTER TABLE public.tabela_agente_buscador
  ADD CONSTRAINT tabela_agente_buscador_status_check
  CHECK (status IN ('coletado', 'processando', 'processado', 'concluido', 'erro'));
