-- Mis tareas del jugador: tareas personales que solo ve su dueño.
-- Acceso solo desde el servidor (RLS activada, sin políticas), como el resto
-- de tablas del rol Jugador. Idempotente.
CREATE TABLE IF NOT EXISTS "player_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" varchar(255) NOT NULL,
  "description" text,
  "due_date" date,
  "done_at" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "player_tasks_user_idx" ON "player_tasks" ("user_id", "due_date");
--> statement-breakpoint
ALTER TABLE "player_tasks" ENABLE ROW LEVEL SECURITY;
