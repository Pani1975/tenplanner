-- Dos pistas con rotación de grupos: en un bloque con rotates = true los dos
-- grupos (A y B) hacen el programa de las dos pistas, uno en cada una, y
-- rotan a mitad: ronda 1 (A en la pista 1, B en la 2) y ronda 2 (cambian).
-- Los minutos de cada elemento son por grupo, así que el bloque dura el
-- doble de la pista más larga. Solo cuenta si la sesión/plantilla usa dos
-- pistas (courts = 2). Por defecto false: todo lo existente queda igual.
-- Idempotente: se puede aplicar más de una vez.
ALTER TABLE "session_blocks" ADD COLUMN IF NOT EXISTS "rotates" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
ALTER TABLE "class_blocks" ADD COLUMN IF NOT EXISTS "rotates" boolean DEFAULT false NOT NULL;
