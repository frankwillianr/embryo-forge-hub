-- Habilita Realtime na tabela de mensagens do orçamento para atualização em tempo real no chat
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'solicitacao_orcamento_mensagem'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE solicitacao_orcamento_mensagem;
  END IF;
END $$;
