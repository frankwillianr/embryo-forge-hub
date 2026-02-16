-- Create storage bucket for jornal audios
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'jornal-audios',
  'jornal-audios',
  true,
  5242880, -- 5MB limit per file
  ARRAY['audio/mpeg', 'audio/mp3']
)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to jornal-audios bucket
CREATE POLICY "Public read access for jornal audios"
ON storage.objects FOR SELECT
USING (bucket_id = 'jornal-audios');

-- Allow authenticated users to insert audio files
CREATE POLICY "Service role can insert jornal audios"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'jornal-audios');

-- Allow service role to delete old audio files
CREATE POLICY "Service role can delete jornal audios"
ON storage.objects FOR DELETE
USING (bucket_id = 'jornal-audios');
