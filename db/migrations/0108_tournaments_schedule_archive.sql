-- Torneos: archivar los ya pasados y publicar el orden de juego.
-- Idempotente. Los partidos ya tenían scheduled_at y court_label (0106).

-- Archivado: sale de la lista principal del organizador; no se borra nada.
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;
--> statement-breakpoint
-- Orden de juego (día, hora y pista de cada partido): solo lo ven el
-- organizador y su club hasta que se publica.
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "schedule_published_at" timestamp with time zone;
