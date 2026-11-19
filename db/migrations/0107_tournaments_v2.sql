-- Torneos, segunda versión: visibilidad, consentimiento del representante
-- legal, autorización de imagen, fotos, noticias y cartel.
-- Idempotente: se puede aplicar más de una vez. Preparada para pruebas; en
-- producción la aplica David.

-- Visibilidad: público (cualquiera con el enlace) o privado (solo jugadores
-- y familias vinculados al club, o a los alumnos del monitor).
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "visibility" varchar(10) DEFAULT 'public' NOT NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_visibility_chk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_visibility_chk"
      CHECK ("visibility" IN ('public', 'private'));
  END IF;
END $$;
