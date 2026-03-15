-- Corrige persistencia de fotos da empresa:
-- 1) Garante RLS com permissoes de INSERT/UPDATE/DELETE para o dono da empresa
-- 2) Mantem leitura publica das fotos
-- 3) Evita duplicidade da mesma URL por empresa

ALTER TABLE public.rel_cidade_servico_empresa_foto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view empresa fotos" ON public.rel_cidade_servico_empresa_foto;
CREATE POLICY "Public can view empresa fotos"
  ON public.rel_cidade_servico_empresa_foto
  FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Owner can insert empresa fotos" ON public.rel_cidade_servico_empresa_foto;
CREATE POLICY "Owner can insert empresa fotos"
  ON public.rel_cidade_servico_empresa_foto
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.rel_cidade_servico_empresa e
      WHERE e.id = empresa_id
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner can update empresa fotos" ON public.rel_cidade_servico_empresa_foto;
CREATE POLICY "Owner can update empresa fotos"
  ON public.rel_cidade_servico_empresa_foto
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.rel_cidade_servico_empresa e
      WHERE e.id = empresa_id
        AND e.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.rel_cidade_servico_empresa e
      WHERE e.id = empresa_id
        AND e.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Owner can delete empresa fotos" ON public.rel_cidade_servico_empresa_foto;
CREATE POLICY "Owner can delete empresa fotos"
  ON public.rel_cidade_servico_empresa_foto
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.rel_cidade_servico_empresa e
      WHERE e.id = empresa_id
        AND e.user_id = auth.uid()
    )
  );

-- Remove duplicatas antigas para permitir o indice unico.
WITH fotos_ranked AS (
  SELECT
    ctid,
    ROW_NUMBER() OVER (
      PARTITION BY empresa_id, url
      ORDER BY ordem NULLS LAST, ctid
    ) AS rn
  FROM public.rel_cidade_servico_empresa_foto
)
DELETE FROM public.rel_cidade_servico_empresa_foto f
USING fotos_ranked r
WHERE f.ctid = r.ctid
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS rel_cidade_servico_empresa_foto_empresa_url_uidx
  ON public.rel_cidade_servico_empresa_foto (empresa_id, url);
