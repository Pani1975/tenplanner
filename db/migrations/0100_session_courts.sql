-- Sesiones con dos pistas: en una pista se hace un trabajo y en otra otro
-- (p. ej. cesta con el monitor en la pista 1 y peloteo autónomo en la 2).
-- sessions.courts = número de pistas de la sesión (1 o 2; por defecto 1, así
-- que todo lo existente queda igual). Cada item del plan lleva su pista
-- (court) y quién lo dirige (led_by: 'coach' = con monitor, 'auto' =
-- autónomo; null = sin indicar).
-- Idempotente: se puede aplicar más de una vez.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "courts" smallint DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "session_block_items" ADD COLUMN IF NOT EXISTS "court" smallint DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "session_block_items" ADD COLUMN IF NOT EXISTS "led_by" varchar(8);
