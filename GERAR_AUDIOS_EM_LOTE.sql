-- ============================================
-- GERAR ÁUDIOS PARA TODAS AS NOTÍCIAS
-- Execute este SQL no Supabase Dashboard
-- ============================================

-- ATENÇÃO: Este script vai chamar a Edge Function para CADA notícia
-- Se você tem muitas notícias (>100), pode demorar ou dar timeout
-- Neste caso, use o script Node.js alternativo

-- Passo 1: Ver quantas notícias precisam de áudio
SELECT COUNT(*) as total_sem_audio
FROM rel_cidade_jornal
WHERE audio_url IS NULL;

-- Passo 2: Ver as 10 primeiras notícias sem áudio
SELECT id, titulo, created_at
FROM rel_cidade_jornal
WHERE audio_url IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- Passo 3: Gerar áudios (DESCOMENTE PARA EXECUTAR)
-- CUIDADO: Isso vai gerar áudio para TODAS as notícias sem audio_url
-- Pode demorar vários minutos dependendo da quantidade

/*
DO $$
DECLARE
  jornal_record RECORD;
  contador INTEGER := 0;
BEGIN
  FOR jornal_record IN
    SELECT id, titulo
    FROM rel_cidade_jornal
    WHERE audio_url IS NULL
    ORDER BY created_at DESC
    LIMIT 50 -- Limite de 50 notícias por vez para não sobrecarregar
  LOOP
    -- Chama a Edge Function para cada notícia
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-jornal-audio',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object('jornalId', jornal_record.id)
    );

    contador := contador + 1;
    RAISE NOTICE 'Processando % de ?: %', contador, jornal_record.titulo;

    -- Delay de 100ms entre cada chamada para não sobrecarregar
    PERFORM pg_sleep(0.1);
  END LOOP;

  RAISE NOTICE 'Processamento concluído! Total: % notícias', contador;
END $$;
*/

-- ============================================
-- NOTA: O script SQL acima requer a extensão pg_net
-- Se não funcionar, use o script Node.js alternativo
-- ============================================
