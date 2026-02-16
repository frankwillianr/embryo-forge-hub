-- Add audio_url field to rel_cidade_jornal table
ALTER TABLE rel_cidade_jornal
ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Add comment to explain the field
COMMENT ON COLUMN rel_cidade_jornal.audio_url IS 'URL do áudio gerado por TTS (Google Cloud Text-to-Speech) armazenado no Supabase Storage';
