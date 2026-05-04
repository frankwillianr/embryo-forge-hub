ALTER TABLE public.rel_cidade_eventos
  ADD COLUMN IF NOT EXISTS tipo_data text NOT NULL DEFAULT 'dia_unico',
  ADD COLUMN IF NOT EXISTS data_evento_fim date NULL;

ALTER TABLE public.rel_cidade_eventos
  DROP CONSTRAINT IF EXISTS rel_cidade_eventos_tipo_data_check;

ALTER TABLE public.rel_cidade_eventos
  ADD CONSTRAINT rel_cidade_eventos_tipo_data_check
  CHECK (tipo_data IN ('dia_unico', 'periodo'));

UPDATE public.rel_cidade_eventos
SET tipo_data = 'dia_unico'
WHERE tipo_data IS NULL;

CREATE INDEX IF NOT EXISTS idx_rel_cidade_eventos_cidade_periodo
  ON public.rel_cidade_eventos (cidade_id, ativo, data_evento, data_evento_fim);
