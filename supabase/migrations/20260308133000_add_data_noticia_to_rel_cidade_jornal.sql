-- Data real de publicacao da noticia (na fonte original)
ALTER TABLE rel_cidade_jornal
ADD COLUMN IF NOT EXISTS data_noticia date;

COMMENT ON COLUMN rel_cidade_jornal.data_noticia IS
  'Data real em que a noticia foi publicada na fonte original';

-- Backfill para registros antigos que ainda nao possuem a data real
UPDATE rel_cidade_jornal
SET data_noticia = created_at::date
WHERE data_noticia IS NULL;
