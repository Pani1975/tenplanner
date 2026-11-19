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
--> statement-breakpoint
-- Fotos del torneo en la página pública: por defecto no (solo familias y
-- jugadores vinculados, con sesión). El organizador puede activarlo.
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "photos_public" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Noticias del torneo: las escribe el organizador o el club; sin datos de
-- inscritos. published_at nulo = borrador.
CREATE TABLE IF NOT EXISTS "tournament_news" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL,
  "author_type" varchar(10) NOT NULL,
  "author_user_id" uuid,
  "author_name" varchar(160) NOT NULL,
  "title" varchar(160) NOT NULL,
  "body" text NOT NULL,
  "published_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Fotos: el archivo está en el bucket privado tournament-media; se ven con
-- URLs firmadas de corta vida.
CREATE TABLE IF NOT EXISTS "tournament_photos" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL,
  "storage_path" text NOT NULL,
  "caption" varchar(200),
  "width" integer,
  "height" integer,
  "published" boolean DEFAULT false NOT NULL,
  "uploaded_by" uuid,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
-- Personas etiquetadas en una foto: una inscripción y el lado (jugador o
-- pareja). Sirve para avisar de quién no tiene autorización de imagen.
CREATE TABLE IF NOT EXISTS "tournament_photo_tags" (
  "photo_id" uuid NOT NULL,
  "entry_id" uuid NOT NULL,
  "side" varchar(10) NOT NULL,
  CONSTRAINT "tournament_photo_tags_pk" PRIMARY KEY ("photo_id", "entry_id", "side")
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_news_tournament_id_fk') THEN
    ALTER TABLE "tournament_news" ADD CONSTRAINT "tournament_news_tournament_id_fk"
      FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_news_author_user_id_fk') THEN
    ALTER TABLE "tournament_news" ADD CONSTRAINT "tournament_news_author_user_id_fk"
      FOREIGN KEY ("author_user_id") REFERENCES "public"."users"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_news_author_type_chk') THEN
    ALTER TABLE "tournament_news" ADD CONSTRAINT "tournament_news_author_type_chk"
      CHECK ("author_type" IN ('organizer', 'club'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_photos_tournament_id_fk') THEN
    ALTER TABLE "tournament_photos" ADD CONSTRAINT "tournament_photos_tournament_id_fk"
      FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_photos_uploaded_by_fk') THEN
    ALTER TABLE "tournament_photos" ADD CONSTRAINT "tournament_photos_uploaded_by_fk"
      FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_photo_tags_photo_id_fk') THEN
    ALTER TABLE "tournament_photo_tags" ADD CONSTRAINT "tournament_photo_tags_photo_id_fk"
      FOREIGN KEY ("photo_id") REFERENCES "public"."tournament_photos"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_photo_tags_entry_id_fk') THEN
    ALTER TABLE "tournament_photo_tags" ADD CONSTRAINT "tournament_photo_tags_entry_id_fk"
      FOREIGN KEY ("entry_id") REFERENCES "public"."tournament_entries"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_photo_tags_side_chk') THEN
    ALTER TABLE "tournament_photo_tags" ADD CONSTRAINT "tournament_photo_tags_side_chk"
      CHECK ("side" IN ('player', 'partner'));
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournament_news_tournament_idx" ON "tournament_news" USING btree ("tournament_id", "published_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournament_photos_tournament_idx" ON "tournament_photos" USING btree ("tournament_id", "created_at");
--> statement-breakpoint
ALTER TABLE "tournament_news" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tournament_photos" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tournament_photo_tags" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- Bucket privado para fotos y carteles de torneos: sin políticas públicas;
-- solo el servidor accede, con URLs firmadas de corta vida. 5 MB por archivo.
DO $$ BEGIN
  IF to_regclass('storage.buckets') IS NOT NULL THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('tournament-media', 'tournament-media', false, 5242880,
      ARRAY['image/jpeg','image/png','image/webp'])
    ON CONFLICT (id) DO NOTHING;
  END IF;
END $$;

-- Cartel del torneo: plantilla (clásica, pista o con imagen propia) e imagen
-- subida por el organizador (JPG o PNG en el bucket privado tournament-media).
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "poster_template" varchar(10) DEFAULT 'classic' NOT NULL;
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "poster_image_path" text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_poster_template_chk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_poster_template_chk"
      CHECK ("poster_template" IN ('classic', 'court', 'image'));
  END IF;
END $$;
