-- F1 (docs/f1-plan.md, PR 2): traza del motor "Monta la clase" y vía por
-- la que se crea cada sesión, para medir qué % sale del motor.
-- Idempotente. Solo añade columnas que admiten null: no toca datos.

ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "generated_by" varchar(16);
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "generation_input" jsonb;
--> statement-breakpoint
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "generation_trace" jsonb;
--> statement-breakpoint
-- wizard | quick | from_class | duplicate | repeat | dr_planner | template
-- | engine. null = sesión anterior a la medición.
ALTER TABLE "sessions" ADD COLUMN IF NOT EXISTS "created_via" varchar(16);
