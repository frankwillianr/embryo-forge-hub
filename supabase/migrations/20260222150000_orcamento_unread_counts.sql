-- Contagem de conversas com mensagem "não visualizada":
-- última mensagem da conversa foi enviada pelo outro (não pelo usuário atual).
-- Retorna: { recebidos: N, enviados: M } para uso em badges na home.

CREATE OR REPLACE FUNCTION get_orcamento_unread_counts(p_user_id UUID)
RETURNS JSON
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH last_msgs AS (
    SELECT DISTINCT ON (conversa_id) conversa_id, user_id AS last_sender_id
    FROM solicitacao_orcamento_mensagem
    ORDER BY conversa_id, created_at DESC
  ),
  conv_with_sol AS (
    SELECT c.id AS conversa_id, c.user_id AS profissional_id, so.user_id AS solicitante_id
    FROM solicitacao_orcamento_conversa c
    JOIN solicitacao_orcamento so ON so.id = c.solicitacao_id
  )
  SELECT json_build_object(
    'recebidos', COALESCE((
      SELECT COUNT(*)::int
      FROM conv_with_sol c
      JOIN last_msgs lm ON lm.conversa_id = c.conversa_id
      WHERE c.solicitante_id = p_user_id AND lm.last_sender_id != p_user_id
    ), 0),
    'enviados', COALESCE((
      SELECT COUNT(*)::int
      FROM conv_with_sol c
      JOIN last_msgs lm ON lm.conversa_id = c.conversa_id
      WHERE c.profissional_id = p_user_id AND lm.last_sender_id != p_user_id
    ), 0)
  );
$$;

COMMENT ON FUNCTION get_orcamento_unread_counts(UUID) IS 'Conta conversas de orçamento onde a última mensagem não foi enviada pelo usuário (para badge de não lidas).';

-- Apenas o próprio usuário pode chamar com seu id
GRANT EXECUTE ON FUNCTION get_orcamento_unread_counts(UUID) TO authenticated;

-- RLS: não se aplica a função; segurança via SECURITY DEFINER e uso de p_user_id apenas para contagem.
-- O resultado não expõe dados de terceiros, só dois números.
