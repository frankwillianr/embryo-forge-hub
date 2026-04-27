-- O Agente Publicador 05 marca a origem como 'publicado' apos inserir no jornal.
-- Sem este status no CHECK, a publicacao entra no jornal mas a origem fica pendente.

ALTER TABLE public.tabela_agente_buscador
  DROP CONSTRAINT IF EXISTS tabela_agente_buscador_status_check;

ALTER TABLE public.tabela_agente_buscador
  ADD CONSTRAINT tabela_agente_buscador_status_check
  CHECK (status IN ('coletado', 'processando', 'processado', 'concluido', 'publicado', 'erro'));
