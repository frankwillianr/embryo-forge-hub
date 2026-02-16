-- Function to trigger audio generation via Edge Function
CREATE OR REPLACE FUNCTION trigger_jornal_audio_generation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only trigger if it's a new record and doesn't have audio_url yet
  IF (TG_OP = 'INSERT' AND NEW.audio_url IS NULL) THEN
    -- Call Edge Function asynchronously using pg_net
    PERFORM
      net.http_post(
        url := current_setting('app.settings.supabase_url') || '/functions/v1/generate-jornal-audio',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
        ),
        body := jsonb_build_object('jornalId', NEW.id)
      );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS generate_jornal_audio_on_insert ON rel_cidade_jornal;
CREATE TRIGGER generate_jornal_audio_on_insert
  AFTER INSERT ON rel_cidade_jornal
  FOR EACH ROW
  EXECUTE FUNCTION trigger_jornal_audio_generation();

COMMENT ON FUNCTION trigger_jornal_audio_generation() IS 'Trigger para gerar áudio TTS automaticamente quando um jornal é criado';
