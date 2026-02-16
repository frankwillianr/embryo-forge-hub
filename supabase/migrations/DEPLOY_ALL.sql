-- ============================================
-- DEPLOY COMPLETO: Sistema de Áudio TTS
-- Execute este SQL no Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Adicionar campo audio_url na tabela
ALTER TABLE rel_cidade_jornal
ADD COLUMN IF NOT EXISTS audio_url TEXT;

COMMENT ON COLUMN rel_cidade_jornal.audio_url IS 'URL do áudio gerado por TTS armazenado no Supabase Storage';

-- 2. Criar bucket de storage para áudios
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'jornal-audios',
  'jornal-audios',
  true,
  5242880, -- 5MB limit per file
  ARRAY['audio/mpeg', 'audio/mp3']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Políticas de acesso ao bucket
CREATE POLICY IF NOT EXISTS "Public read access for jornal audios"
ON storage.objects FOR SELECT
USING (bucket_id = 'jornal-audios');

CREATE POLICY IF NOT EXISTS "Service role can insert jornal audios"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'jornal-audios');

CREATE POLICY IF NOT EXISTS "Service role can delete jornal audios"
ON storage.objects FOR DELETE
USING (bucket_id = 'jornal-audios');

-- ============================================
-- ✅ DEPLOY CONCLUÍDO!
-- Próximo passo: Deploy da Edge Function
-- ============================================
