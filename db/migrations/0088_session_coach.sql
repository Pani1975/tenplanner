-- Monitor que imparte la sesión (puede ser distinto de quien la creó, p. ej.
-- el gestor del club crea la sesión y se la asigna a un monitor). null = la
-- imparte quien la creó (user_id). "Mis sesiones" en modo club y el filtro
-- por monitor usan COALESCE(coach_id, user_id).
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "coach_id" uuid REFERENCES "users"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "sessions_coach_id_idx" ON "sessions" ("coach_id");
