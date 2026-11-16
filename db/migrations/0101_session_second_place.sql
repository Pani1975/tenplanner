-- Sesiones con dos pistas: lugar de la segunda pista (Mis lugares). La sesión
-- ocupa los dos lugares (placeId y second_place_id) en las reservas y en el
-- aviso de coincidencias. null = sin segundo lugar (una pista, como siempre).
-- Idempotente: se puede aplicar más de una vez.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "second_place_id" uuid REFERENCES "places"("id") ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "sessions_second_place_id_idx" ON "sessions" ("second_place_id");
