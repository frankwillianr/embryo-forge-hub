-- Reset de testes do Agente 04: limpa links de imagens geradas
UPDATE public.tabela_agente_buscador
SET
  imagem_refeita = NULL,
  agente_imagem_updated_at = NULL
WHERE imagem_refeita IS NOT NULL;
