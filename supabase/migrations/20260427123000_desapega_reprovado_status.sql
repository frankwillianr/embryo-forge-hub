-- Marketplace Local: inclui status de reprovacao para moderacao admin.

DO $$
DECLARE
  c RECORD;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'rel_cidade_desapega'
  ) THEN
    FOR c IN
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE nsp.nspname = 'public'
        AND rel.relname = 'rel_cidade_desapega'
        AND con.contype = 'c'
        AND pg_get_constraintdef(con.oid) ILIKE '%status%'
    LOOP
      EXECUTE format('ALTER TABLE public.rel_cidade_desapega DROP CONSTRAINT %I', c.conname);
    END LOOP;

    ALTER TABLE public.rel_cidade_desapega
    ADD CONSTRAINT rel_cidade_desapega_status_check
    CHECK (status IN (
      'aguardando_aprovacao',
      'aprovado',
      'reprovado',
      'inativo',
      'vendido',
      'removido'
    ));
  END IF;
END $$;
