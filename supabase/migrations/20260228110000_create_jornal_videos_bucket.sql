-- Create storage bucket for jornal videos (admin uploads)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'jornal-videos',
  'jornal-videos',
  true,
  52428800, -- 50MB limit per file
  ARRAY['video/mp4', 'video/webm', 'video/quicktime', 'video/x-m4v']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access (qualquer um pode ver os vídeos)
CREATE POLICY "Public read access for jornal videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'jornal-videos');

-- Permitir insert (upload) para anon e authenticated (admin usa cliente browser)
CREATE POLICY "Allow insert jornal videos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'jornal-videos');

-- Permitir delete (remover vídeo)
CREATE POLICY "Allow delete jornal videos"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'jornal-videos');

-- Permitir update (substituir arquivo)
CREATE POLICY "Allow update jornal videos"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'jornal-videos');
