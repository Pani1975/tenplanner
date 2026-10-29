-- Objetivos personalizables: un club, un monitor o un alumno pueden añadir objetivos propios
-- y ocultar/editar los del catálogo base. Idempotente. Sin políticas RLS: la app accede con Drizzle.
ALTER TABLE "tennis_objectives" ADD COLUMN IF NOT EXISTS "club_id" uuid REFERENCES "clubs"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "tennis_objectives" ADD COLUMN IF NOT EXISTS "coach_id" uuid REFERENCES "users"("id") ON DELETE cascade;--> statement-breakpoint
ALTER TABLE "tennis_objectives" ADD COLUMN IF NOT EXISTS "student_id" uuid REFERENCES "students"("id") ON DELETE cascade;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tennis_objectives" ADD CONSTRAINT "tennis_objectives_single_scope_chk" CHECK (num_nonnulls("club_id","coach_id","student_id") <= 1);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tennis_objectives_club_id_idx" ON "tennis_objectives" ("club_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tennis_objectives_coach_id_idx" ON "tennis_objectives" ("coach_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "tennis_objectives_student_id_idx" ON "tennis_objectives" ("student_id");--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "objective_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"objective_id" uuid NOT NULL REFERENCES "tennis_objectives"("id") ON DELETE cascade,
	"club_id" uuid REFERENCES "clubs"("id") ON DELETE cascade,
	"coach_id" uuid REFERENCES "users"("id") ON DELETE cascade,
	"student_id" uuid REFERENCES "students"("id") ON DELETE cascade,
	"hidden" boolean,
	"title" text,
	"criterion" text,
	"updated_by" uuid REFERENCES "users"("id") ON DELETE set null,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "objective_overrides_single_scope_chk" CHECK (num_nonnulls("club_id","coach_id","student_id") = 1)
);--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "objective_overrides_club_uniq" ON "objective_overrides" ("objective_id","club_id") WHERE "club_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "objective_overrides_coach_uniq" ON "objective_overrides" ("objective_id","coach_id") WHERE "coach_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "objective_overrides_student_uniq" ON "objective_overrides" ("objective_id","student_id") WHERE "student_id" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "objective_overrides_student_idx" ON "objective_overrides" ("student_id");--> statement-breakpoint
ALTER TABLE "objective_overrides" ENABLE ROW LEVEL SECURITY;
