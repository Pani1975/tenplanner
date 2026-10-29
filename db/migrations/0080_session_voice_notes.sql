ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "coach_audio_path" text;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "coach_audio_seconds" integer;
--> statement-breakpoint
ALTER TABLE "session_block_items" ADD COLUMN IF NOT EXISTS "coach_audio_path" text;
--> statement-breakpoint
ALTER TABLE "session_block_items" ADD COLUMN IF NOT EXISTS "coach_audio_seconds" integer;
--> statement-breakpoint
-- Bucket privado para las notas de voz (voces de alumnos y monitores): sin
-- políticas públicas; solo el servidor accede, con URLs firmadas de corta vida.
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('session-audio', 'session-audio', false, 3145728,
      ARRAY['audio/webm','audio/mp4','audio/ogg','audio/mpeg','audio/aac','audio/x-m4a','audio/wav'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;
