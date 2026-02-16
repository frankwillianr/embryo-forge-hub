-- ============================================
-- VERIFICAR SE O DEPLOY FOI BEM-SUCEDIDO
-- Execute este SQL no Supabase Dashboard
-- ============================================

-- 1. Verificar se o campo audio_url foi criado
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'rel_cidade_jornal'
AND column_name = 'audio_url';
-- Deve retornar 1 linha: audio_url | text

-- 2. Verificar se o bucket foi criado
SELECT id, name, public, file_size_limit
FROM storage.buckets
WHERE id = 'jornal-audios';
-- Deve retornar 1 linha: jornal-audios

-- 3. Verificar políticas de acesso
SELECT policyname
FROM pg_policies
WHERE tablename = 'objects'
AND policyname LIKE '%jornal audios%';
-- Deve retornar 3 políticas

-- ============================================
-- ✅ Se todas as queries retornaram resultados,
-- o deploy do banco está completo!
-- ============================================
