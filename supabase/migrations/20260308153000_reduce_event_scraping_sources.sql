-- Reduz fontes de scraping de eventos para:
-- Sympla, Ingresso.com, G1 Vales e DRD Cultura

-- Garante as 4 fontes ativas para GV (seed principal)
INSERT INTO cidade_scraping_evento_fonte (cidade_id, nome, tipo, url, ativo, ordem)
VALUES
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'Sympla GV', 'html', 'https://www.sympla.com.br/eventos/governador-valadares-mg', true, 1),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'Ingresso.com', 'html', 'https://www.ingresso.com/', true, 2),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'G1 Vales', 'html', 'https://g1.globo.com/mg/vales-mg/', true, 3),
  ('2bafc0da-6960-403b-b25b-79f72066775a', 'DRD Cultura', 'html', 'https://drd.com.br/', true, 4)
ON CONFLICT (cidade_id, nome)
DO UPDATE SET
  tipo = EXCLUDED.tipo,
  url = EXCLUDED.url,
  ativo = true,
  ordem = EXCLUDED.ordem,
  updated_at = now();

-- Desativa fontes extras em GV
UPDATE cidade_scraping_evento_fonte
SET ativo = false,
    updated_at = now()
WHERE cidade_id = '2bafc0da-6960-403b-b25b-79f72066775a'
  AND nome NOT IN ('Sympla GV', 'Ingresso.com', 'G1 Vales', 'DRD Cultura');
