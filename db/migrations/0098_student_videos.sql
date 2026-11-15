-- Fichas de vídeo de cada alumno: lugar de grabación, evento (torneo), fecha,
-- observaciones y enlace al vídeo (YouTube, Google Drive...). No se suben
-- archivos: solo se guarda el enlace.
-- Idempotente: se puede aplicar más de una vez.
CREATE TABLE IF NOT EXISTS "student_videos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "created_by" uuid,
  "location" varchar(200),
  "event" varchar(200),
  "recorded_on" date,
  "notes" text,
  "video_url" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_videos_student_id_students_id_fk') THEN
    ALTER TABLE "student_videos" ADD CONSTRAINT "student_videos_student_id_students_id_fk"
      FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_videos_created_by_users_id_fk') THEN
    ALTER TABLE "student_videos" ADD CONSTRAINT "student_videos_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'student_videos_video_url_chk') THEN
    ALTER TABLE "student_videos" ADD CONSTRAINT "student_videos_video_url_chk"
      CHECK ("video_url" ~* '^https?://');
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "student_videos_student_recorded_idx" ON "student_videos" USING btree ("student_id","recorded_on");
--> statement-breakpoint
-- Solo la aplicación (conexión directa) accede a la tabla.
ALTER TABLE "student_videos" ENABLE ROW LEVEL SECURITY;
