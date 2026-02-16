-- Verificar se os áudios estão sendo salvos no Storage (correto)
-- vs URLs externas do Yandex (incorreto)

-- 1. Contar por tipo de URL
SELECT
  CASE
    WHEN audio_url LIKE '%supabase.co/storage%' THEN 'Storage (Correto)'
    WHEN audio_url LIKE '%yandex%' THEN 'Yandex (Fallback)'
    WHEN audio_url IS NULL THEN 'Sem áudio'
    ELSE 'Outro'
  END as tipo_url,
  COUNT(*) as quantidade
FROM rel_cidade_jornal
GROUP BY tipo_url
ORDER BY quantidade DESC;

-- 2. Ver exemplos de URLs do Storage (as novas)
SELECT id, titulo, audio_url
FROM rel_cidade_jornal
WHERE audio_url LIKE '%supabase.co/storage%'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Ver se ainda tem URLs do Yandex (as antigas)
SELECT id, titulo, audio_url
FROM rel_cidade_jornal
WHERE audio_url LIKE '%yandex%'
ORDER BY created_at DESC
LIMIT 3;
