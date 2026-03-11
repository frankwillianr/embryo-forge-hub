-- Ajustes de compatibilidade do Marketplace Local (Desapega):
-- 1) garante user_id para controle de dono
-- 2) garante status com valores necessarios para fluxo de vendido/removido

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
        AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.rel_cidade_desapega
      ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'rel_cidade_desapega'
        AND column_name = 'status'
    ) THEN
      ALTER TABLE public.rel_cidade_desapega
      ADD COLUMN status text NOT NULL DEFAULT 'ativo';
    END IF;

    UPDATE public.rel_cidade_desapega
    SET status = 'ativo'
    WHERE status IS NULL;

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
    CHECK (status IN ('ativo', 'inativo', 'vendido', 'removido'));

    CREATE INDEX IF NOT EXISTS idx_rel_cidade_desapega_status
      ON public.rel_cidade_desapega(status);

    CREATE INDEX IF NOT EXISTS idx_rel_cidade_desapega_user_id
      ON public.rel_cidade_desapega(user_id);
  END IF;
END $$;
