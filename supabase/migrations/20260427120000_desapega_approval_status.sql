-- Marketplace Local (Desapega): novos anuncios aguardam aprovacao
-- e a vitrine publica passa a usar apenas status 'aprovado'.

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
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'rel_cidade_desapega'
        AND column_name = 'status'
    ) THEN
      ALTER TABLE public.rel_cidade_desapega
      ADD COLUMN status text NOT NULL DEFAULT 'aguardando_aprovacao';
    END IF;

    -- Mantem anuncios ja publicados visiveis apos a mudanca.
    UPDATE public.rel_cidade_desapega
    SET status = 'aprovado'
    WHERE status IS NULL OR status = 'ativo';

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
      ALTER COLUMN status SET DEFAULT 'aguardando_aprovacao',
      ALTER COLUMN status SET NOT NULL;

    ALTER TABLE public.rel_cidade_desapega
    ADD CONSTRAINT rel_cidade_desapega_status_check
    CHECK (status IN (
      'aguardando_aprovacao',
      'aprovado',
      'inativo',
      'vendido',
      'removido'
    ));

    CREATE INDEX IF NOT EXISTS idx_rel_cidade_desapega_status
      ON public.rel_cidade_desapega(status);
  END IF;
END $$;
