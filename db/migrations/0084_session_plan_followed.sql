-- Cierre de sesión: si se dio tal y como estaba planificada, motivo del
-- cambio (opcional) y valoración final de la clase (1-5).
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "plan_followed" boolean;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "plan_change_reason" varchar(40);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "session_rating" integer;
