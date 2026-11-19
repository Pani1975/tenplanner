-- Torneos: un club (modo club) o un monitor (modo particular) organiza un
-- torneo; los participantes vienen de sus alumnos o de un enlace público.
-- Los datos de contacto solo los ve el organizador; la página pública solo
-- muestra nombre e inicial (lib/tournaments/public-name.ts).
-- Idempotente: se puede aplicar más de una vez. NO aplicada en producción.
CREATE TABLE IF NOT EXISTS "tournaments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_type" varchar(10) NOT NULL,
  "club_id" uuid,
  "coach_id" uuid,
  "created_by" uuid NOT NULL,
  "sport" "sport" DEFAULT 'tenis' NOT NULL,
  "name" varchar(160) NOT NULL,
  "slug" varchar(80) NOT NULL,
  "description" text,
  "modality" varchar(10) NOT NULL,
  "level_code" varchar(32),
  "format" varchar(20) NOT NULL,
  "status" varchar(20) DEFAULT 'draft' NOT NULL,
  "max_entries" integer,
  "start_date" date NOT NULL,
  "end_date" date,
  "registration_deadline" timestamp with time zone,
  "place_ids" jsonb,
  "best_of" smallint DEFAULT 3 NOT NULL,
  "games_per_set" smallint DEFAULT 6 NOT NULL,
  "final_set" varchar(20) DEFAULT 'super_tiebreak' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tournament_entries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL,
  "source" varchar(10) NOT NULL,
  "student_id" uuid,
  "group_id" uuid,
  "first_name" varchar(120) NOT NULL,
  "last_name" varchar(160),
  "email" varchar(255),
  "phone" varchar(32),
  "is_minor" boolean DEFAULT false NOT NULL,
  "guardian_name" varchar(120),
  "guardian_email" varchar(255),
  "guardian_phone" varchar(32),
  "level_code" varchar(32),
  "partner_student_id" uuid,
  "partner_first_name" varchar(120),
  "partner_last_name" varchar(160),
  "partner_email" varchar(255),
  "partner_phone" varchar(32),
  "partner_is_minor" boolean DEFAULT false NOT NULL,
  "partner_guardian_name" varchar(120),
  "partner_guardian_email" varchar(255),
  "partner_guardian_phone" varchar(32),
  "status" varchar(12) DEFAULT 'pending' NOT NULL,
  "seed" smallint,
  "consent_at" timestamp with time zone,
  "consent_version" varchar(20),
  "consent_method" varchar(20),
  "consent_by_user_id" uuid,
  "consent_by_name" varchar(120),
  "cancel_token" varchar(64),
  "confirmed_at" timestamp with time zone,
  "cancelled_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "tournament_matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tournament_id" uuid NOT NULL,
  "round" smallint NOT NULL,
  "position" smallint NOT NULL,
  "group_label" varchar(10),
  "entry_a_id" uuid,
  "entry_b_id" uuid,
  "score" jsonb,
  "result_type" varchar(12),
  "winner_entry_id" uuid,
  "status" varchar(12) DEFAULT 'pending' NOT NULL,
  "next_match_id" uuid,
  "next_slot" varchar(1),
  "scheduled_at" timestamp with time zone,
  "court_label" varchar(60),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  -- tournaments
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_club_id_clubs_id_fk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_club_id_clubs_id_fk"
      FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_coach_id_users_id_fk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_coach_id_users_id_fk"
      FOREIGN KEY ("coach_id") REFERENCES "public"."users"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_created_by_users_id_fk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_level_code_skill_levels_code_fk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_level_code_skill_levels_code_fk"
      FOREIGN KEY ("level_code") REFERENCES "public"."skill_levels"("code") ON DELETE set null ON UPDATE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_owner_chk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_owner_chk" CHECK (
      ("owner_type" = 'club' AND "club_id" IS NOT NULL)
      OR ("owner_type" = 'coach' AND "coach_id" IS NOT NULL AND "club_id" IS NULL)
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_modality_chk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_modality_chk"
      CHECK ("modality" IN ('singles', 'doubles'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_format_chk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_format_chk"
      CHECK ("format" IN ('knockout', 'round_robin'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_status_chk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_status_chk"
      CHECK ("status" IN ('draft', 'open', 'closed', 'in_progress', 'finished'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_scoring_chk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_scoring_chk" CHECK (
      "best_of" IN (1, 3, 5)
      AND "games_per_set" BETWEEN 3 AND 8
      AND "final_set" IN ('full', 'super_tiebreak')
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournaments_max_entries_chk') THEN
    ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_max_entries_chk"
      CHECK ("max_entries" IS NULL OR "max_entries" BETWEEN 2 AND 256);
  END IF;

  -- tournament_entries
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_tournament_id_fk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_tournament_id_fk"
      FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_student_id_fk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_student_id_fk"
      FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_partner_student_id_fk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_partner_student_id_fk"
      FOREIGN KEY ("partner_student_id") REFERENCES "public"."students"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_group_id_fk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_group_id_fk"
      FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_level_code_fk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_level_code_fk"
      FOREIGN KEY ("level_code") REFERENCES "public"."skill_levels"("code") ON DELETE set null ON UPDATE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_consent_by_user_id_fk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_consent_by_user_id_fk"
      FOREIGN KEY ("consent_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_source_chk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_source_chk"
      CHECK ("source" IN ('school', 'link'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_status_chk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_status_chk"
      CHECK ("status" IN ('pending', 'confirmed', 'waitlist', 'cancelled'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_consent_method_chk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_consent_method_chk"
      CHECK ("consent_method" IS NULL OR "consent_method" IN ('form', 'coach_declared', 'guardian_link'));
  END IF;
  -- Confirmada = con consentimiento registrado.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_confirmed_consent_chk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_confirmed_consent_chk"
      CHECK ("status" <> 'confirmed' OR "consent_at" IS NOT NULL);
  END IF;
  -- Un menor necesita algún contacto del tutor.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_entries_minor_guardian_chk') THEN
    ALTER TABLE "tournament_entries" ADD CONSTRAINT "tournament_entries_minor_guardian_chk"
      CHECK (NOT "is_minor" OR "source" = 'school' OR "guardian_email" IS NOT NULL OR "guardian_phone" IS NOT NULL);
  END IF;

  -- tournament_matches
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_tournament_id_fk') THEN
    ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_tournament_id_fk"
      FOREIGN KEY ("tournament_id") REFERENCES "public"."tournaments"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_entry_a_id_fk') THEN
    ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_entry_a_id_fk"
      FOREIGN KEY ("entry_a_id") REFERENCES "public"."tournament_entries"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_entry_b_id_fk') THEN
    ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_entry_b_id_fk"
      FOREIGN KEY ("entry_b_id") REFERENCES "public"."tournament_entries"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_winner_entry_id_fk') THEN
    ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_winner_entry_id_fk"
      FOREIGN KEY ("winner_entry_id") REFERENCES "public"."tournament_entries"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_next_match_id_fk') THEN
    ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_next_match_id_fk"
      FOREIGN KEY ("next_match_id") REFERENCES "public"."tournament_matches"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_status_chk') THEN
    ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_status_chk"
      CHECK ("status" IN ('pending', 'played', 'bye'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_result_type_chk') THEN
    ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_result_type_chk"
      CHECK ("result_type" IS NULL OR "result_type" IN ('normal', 'walkover', 'retired'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tournament_matches_next_slot_chk') THEN
    ALTER TABLE "tournament_matches" ADD CONSTRAINT "tournament_matches_next_slot_chk"
      CHECK ("next_slot" IS NULL OR "next_slot" IN ('a', 'b'));
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournaments_slug_uniq" ON "tournaments" USING btree ("slug");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournaments_club_id_idx" ON "tournaments" USING btree ("club_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournaments_coach_id_idx" ON "tournaments" USING btree ("coach_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tournament_entries_tournament_status_idx" ON "tournament_entries" USING btree ("tournament_id", "status", "created_at");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_entries_cancel_token_uniq" ON "tournament_entries" USING btree ("cancel_token");
--> statement-breakpoint
-- Sin duplicados (las canceladas no cuentan). Que un alumno esté a la vez
-- como jugador en una inscripción y como pareja en otra lo comprueba la
-- aplicación (lib/tournaments/entries.ts).
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_entries_student_uniq" ON "tournament_entries" USING btree ("tournament_id", "student_id")
  WHERE "student_id" IS NOT NULL AND "status" <> 'cancelled';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_entries_partner_student_uniq" ON "tournament_entries" USING btree ("tournament_id", "partner_student_id")
  WHERE "partner_student_id" IS NOT NULL AND "status" <> 'cancelled';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_entries_email_uniq" ON "tournament_entries" USING btree ("tournament_id", lower("email"))
  WHERE "email" IS NOT NULL AND "status" <> 'cancelled';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_entries_phone_uniq" ON "tournament_entries" USING btree ("tournament_id", "phone")
  WHERE "phone" IS NOT NULL AND "status" <> 'cancelled';
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "tournament_matches_slot_uniq" ON "tournament_matches" USING btree ("tournament_id", "round", "position");
--> statement-breakpoint
-- Solo la aplicación (conexión directa) accede a las tablas.
ALTER TABLE "tournaments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tournament_entries" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tournament_matches" ENABLE ROW LEVEL SECURITY;
