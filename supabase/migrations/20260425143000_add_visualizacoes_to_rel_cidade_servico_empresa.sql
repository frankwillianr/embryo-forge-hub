ALTER TABLE public.rel_cidade_servico_empresa
ADD COLUMN IF NOT EXISTS visualizacoes bigint NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.rel_cidade_servico_empresa.visualizacoes IS
'Contador de visualizacoes das ofertas/empresa exibidas no app.';
