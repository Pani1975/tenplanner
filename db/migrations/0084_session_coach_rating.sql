-- Valoración global de la clase (1 a 5 estrellas) que el monitor da al terminar la sesión.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "coach_rating" integer;
