CREATE TABLE IF NOT EXISTS public.rel_cidade_push_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cidade_id uuid NOT NULL,
  device_token text NOT NULL,
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rel_cidade_push_tokens_cidade_token_uk
  ON public.rel_cidade_push_tokens (cidade_id, device_token);

ALTER TABLE public.rel_cidade_push_tokens ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rel_cidade_push_tokens'
      AND policyname = 'push_tokens_insert_public'
  ) THEN
    CREATE POLICY push_tokens_insert_public
      ON public.rel_cidade_push_tokens
      FOR INSERT
      TO anon, authenticated
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'rel_cidade_push_tokens'
      AND policyname = 'push_tokens_update_public'
  ) THEN
    CREATE POLICY push_tokens_update_public
      ON public.rel_cidade_push_tokens
      FOR UPDATE
      TO anon, authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_push_tokens_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rel_cidade_push_tokens_updated_at ON public.rel_cidade_push_tokens;
CREATE TRIGGER trg_rel_cidade_push_tokens_updated_at
BEFORE UPDATE ON public.rel_cidade_push_tokens
FOR EACH ROW
EXECUTE FUNCTION public.set_push_tokens_updated_at();
