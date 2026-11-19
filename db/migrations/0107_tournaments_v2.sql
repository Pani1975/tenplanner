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
--> statement-breakpoint
-- Dobles: el consentimiento de cada jugador lo da su propio representante
-- legal. Los campos consent_* son del jugador; estos, de la pareja. La
-- inscripción se confirma cuando están los dos.
ALTER TABLE "tournament_entries" ADD COLUMN IF NOT EXISTS "partner_consent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD COLUMN IF NOT EXISTS "partner_consent_method" varchar(20);
--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD COLUMN IF NOT EXISTS "partner_consent_by_user_id" uuid;
--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD COLUMN IF NOT EXISTS "partner_consent_by_name" varchar(120);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_partner_consent_by_user_id_fk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_partner_consent_by_user_id_fk"
      FOREIGN KEY ("partner_consent_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_partner_consent_method_chk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_partner_consent_method_chk"
      CHECK ("partner_consent_method" IS NULL OR "partner_consent_method" IN ('form', 'coach_declared', 'guardian_link'));
  END IF;
END $$;
--> statement-breakpoint
-- Inscripciones ya existentes de dobles: el consentimiento que tenían
-- cubría a la pareja (lo daba el monitor o el formulario).
UPDATE "tournament_entries"
  SET "partner_consent_at" = "consent_at",
      "partner_consent_method" = "consent_method",
      "partner_consent_by_user_id" = "consent_by_user_id",
      "partner_consent_by_name" = "consent_by_name"
  WHERE "partner_first_name" IS NOT NULL AND "consent_at" IS NOT NULL AND "partner_consent_at" IS NULL;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_confirmed_partner_consent_chk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_confirmed_partner_consent_chk"
      CHECK ("status" <> 'confirmed' OR "partner_first_name" IS NULL OR "partner_consent_at" IS NOT NULL);
  END IF;
END $$;
--> statement-breakpoint
-- Autorización de imagen, guardada en la persona (vale para todo, no solo
-- para un torneo): sí / no / sin datos (NULL), fecha del documento firmado,
-- referencia a ese documento (texto: dónde está guardado) y quién la anotó.
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "image_consent" boolean;
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "image_consent_on" date;
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "image_consent_ref" varchar(200);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "image_consent_by" uuid;
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'students_image_consent_by_users_id_fk') THEN
    ALTER TABLE "students" ADD CONSTRAINT "students_image_consent_by_users_id_fk"
      FOREIGN KEY ("image_consent_by") REFERENCES "public"."users"("id") ON DELETE set null;
  END IF;
END $$;
--> statement-breakpoint
-- Jugadores externos (enlace o añadidos a mano): no tienen ficha de alumno;
-- su autorización de imagen se guarda en la inscripción.
ALTER TABLE "tournament_entries" ADD COLUMN IF NOT EXISTS "image_consent_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "tournament_entries" ADD COLUMN IF NOT EXISTS "partner_image_consent_at" timestamp with time zone;
