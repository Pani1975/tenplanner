-- Tareas del Modo gestión: las crea y ve solo el gestor del club (su dueño).
-- Idempotente: se puede aplicar más de una vez.
CREATE TABLE IF NOT EXISTS "management_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "club_id" uuid NOT NULL,
  "created_by" uuid NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "due_date" date,
  "notify_email" boolean DEFAULT false NOT NULL,
  "notified_at" timestamp with time zone,
  "responsible_kind" varchar(10) DEFAULT 'club' NOT NULL,
  "responsible_user_id" uuid,
  "responsible_text" varchar(255),
  "done_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'management_tasks_club_id_clubs_id_fk') THEN
    ALTER TABLE "management_tasks" ADD CONSTRAINT "management_tasks_club_id_clubs_id_fk"
      FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'management_tasks_created_by_users_id_fk') THEN
    ALTER TABLE "management_tasks" ADD CONSTRAINT "management_tasks_created_by_users_id_fk"
      FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'management_tasks_responsible_user_id_users_id_fk') THEN
    ALTER TABLE "management_tasks" ADD CONSTRAINT "management_tasks_responsible_user_id_users_id_fk"
      FOREIGN KEY ("responsible_user_id") REFERENCES "public"."users"("id") ON DELETE set null;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'management_tasks_responsible_kind_chk') THEN
    ALTER TABLE "management_tasks" ADD CONSTRAINT "management_tasks_responsible_kind_chk"
      CHECK ("responsible_kind" IN ('coach', 'club', 'other'));
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "management_tasks_club_due_idx" ON "management_tasks" USING btree ("club_id","due_date");
--> statement-breakpoint
-- Solo la aplicación (conexión directa) accede a la tabla.
ALTER TABLE "management_tasks" ENABLE ROW LEVEL SECURITY;
