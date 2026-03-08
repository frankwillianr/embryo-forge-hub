-- Fix trigger: do not fail inserts when app.settings.* is not configured
CREATE OR REPLACE FUNCTION trigger_jornal_audio_generation()
RETURNS TRIGGER AS $$
DECLARE
  v_supabase_url text;
  v_service_role_key text;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.audio_url IS NULL) THEN
    v_supabase_url := current_setting('app.settings.supabase_url', true);
    v_service_role_key := current_setting('app.settings.service_role_key', true);

    IF v_supabase_url IS NOT NULL
      AND v_supabase_url <> ''
      AND v_service_role_key IS NOT NULL
      AND v_service_role_key <> '' THEN
      PERFORM net.http_post(
        url := v_supabase_url || '/functions/v1/generate-jornal-audio',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || v_service_role_key
        ),
        body := jsonb_build_object('jornalId', NEW.id)
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
