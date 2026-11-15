-- Publicación de los ejercicios de la biblioteca de Ten Planner.
-- Un ejercicio global (is_global) solo aparece en la biblioteca, el buscador,
-- Dr. Planner y las propuestas de sesión si está publicado. El administrador
-- los ve todos y decide cuáles publicar. Los ejercicios privados no cambian.
-- Las clases y sesiones que ya usan un ejercicio sin publicar siguen
-- funcionando (la ficha se abre por enlace directo).
-- Idempotente: se puede aplicar más de una vez. Por defecto todo queda
-- publicado; ocultar la biblioteca es un paso de datos aparte.
ALTER TABLE "exercises" ADD COLUMN IF NOT EXISTS "is_published" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exercises_global_published_idx" ON "exercises" ("is_global", "is_published");
