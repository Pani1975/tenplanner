-- Dos pistas con turnos: un elemento puede hacerse «por turnos», pasando los
-- alumnos de turn_size en turn_size (1 = de uno en uno) y cada uno
-- turn_minutes minutos, mientras el resto está en la otra pista. Con eso se
-- calcula cuántos minutos hace cada alumno de cada cosa (p. ej. bloque de
-- 20 min, 4 alumnos: peloteo por turnos de 5 min y saque 20 min seguidos →
-- cada alumno hace 5 min de peloteo y 15 de saque).
-- null = todos a la vez (como siempre). Solo cuenta con dos pistas.
-- Idempotente: se puede aplicar más de una vez.
ALTER TABLE "session_block_items" ADD COLUMN IF NOT EXISTS "turn_minutes" smallint;
--> statement-breakpoint
ALTER TABLE "session_block_items" ADD COLUMN IF NOT EXISTS "turn_size" smallint;
--> statement-breakpoint
ALTER TABLE "class_block_exercises" ADD COLUMN IF NOT EXISTS "turn_minutes" smallint;
--> statement-breakpoint
ALTER TABLE "class_block_exercises" ADD COLUMN IF NOT EXISTS "turn_size" smallint;
