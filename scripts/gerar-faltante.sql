-- Ver qual notícia ficou sem áudio
SELECT id, titulo, created_at
FROM rel_cidade_jornal
WHERE audio_url IS NULL
ORDER BY created_at DESC;

-- Copie o ID e use no script abaixo
