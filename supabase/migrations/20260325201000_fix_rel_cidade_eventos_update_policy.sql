-- Garante que apenas admins da cidade possam editar eventos.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rel_cidade_eventos'
      AND policyname = 'Cidade admin can update eventos'
  ) THEN
    DROP POLICY "Cidade admin can update eventos" ON public.rel_cidade_eventos;
  END IF;
END $$;

CREATE POLICY "Cidade admin can update eventos"
  ON public.rel_cidade_eventos
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_da_cidade(cidade_id, auth.uid()))
  WITH CHECK (public.is_admin_da_cidade(cidade_id, auth.uid()));
