-- Plantillas de clase con dos pistas (como las sesiones, ver 0100):
-- classes.courts = pistas que usa la plantilla (1 o 2; por defecto 1) y cada
-- elemento del plan lleva su pista (court) y quién lo dirige (led_by:
-- 'coach' = con monitor, 'auto' = autónomo; null = sin indicar).
-- Al montar una sesión desde la clase, se copian a la sesión.
-- Idempotente: se puede aplicar más de una vez.
ALTER TABLE "classes" ADD COLUMN IF NOT EXISTS "courts" smallint DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "class_block_exercises" ADD COLUMN IF NOT EXISTS "court" smallint DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "class_block_exercises" ADD COLUMN IF NOT EXISTS "led_by" varchar(8);
