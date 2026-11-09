-- Cierre de sesión: ¿se dio tal y como estaba planificada? y motivo del
-- cambio (opcional). La valoración final va en coach_rating (0084).
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "plan_followed" boolean;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "plan_change_reason" varchar(40);
