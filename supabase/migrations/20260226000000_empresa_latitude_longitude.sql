-- Coordenadas para exibir empresas no mapa (pins)
ALTER TABLE rel_cidade_servico_empresa
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

COMMENT ON COLUMN rel_cidade_servico_empresa.latitude IS 'Latitude para exibir a empresa no mapa';
COMMENT ON COLUMN rel_cidade_servico_empresa.longitude IS 'Longitude para exibir a empresa no mapa';
