-- Corrige RLS do bucket jornal-videos: permite upload/delete para anon e authenticated (TO public).
-- Execute este SQL no Supabase se aparecer "new row violates row-level security policy" no upload.

DROP POLICY IF EXISTS "Public read access for jornal videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow insert jornal videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete jornal videos" ON storage.objects;
DROP POLICY IF EXISTS "Allow update jornal videos" ON storage.objects;

CREATE POLICY "Public read access for jornal videos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'jornal-videos');

CREATE POLICY "Allow insert jornal videos"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'jornal-videos');

CREATE POLICY "Allow delete jornal videos"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'jornal-videos');

CREATE POLICY "Allow update jornal videos"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'jornal-videos');
