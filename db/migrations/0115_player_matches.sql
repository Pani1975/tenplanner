-- Mis partidos: registro privado de la actividad de un jugador (torneos,
-- partidos oficiales, amistosos y entrenamientos). Solo lo ve y lo edita su
-- dueño (user_id); el club no lo ve. Los datos del rival son de terceros:
-- nunca salen en listados públicos ni en la API de otros usuarios.
-- El acceso es solo desde el servidor (comprueba user_id); RLS activado sin
-- políticas para cerrar el acceso directo desde el cliente, como en torneos.
-- Idempotente: se puede aplicar más de una vez.
DO $$ BEGIN
  CREATE TYPE "match_type" AS ENUM ('torneo', 'partido_oficial', 'amistoso', 'entrenamiento');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "matches" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "match_type" "match_type" NOT NULL,
  "match_date" date NOT NULL,
  "tournament_url" text,
  "rival_first_name" text,
  "rival_last_name" text,
  "rival_license" text,
  "final_result" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "matches" ADD CONSTRAINT "matches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "matches_user_date_idx" ON "matches" USING btree ("user_id", "match_date");
--> statement-breakpoint
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;
