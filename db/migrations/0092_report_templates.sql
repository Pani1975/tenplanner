-- Plantillas del informe de gestión: un diseño guardado (qué datos incluye)
-- para generar ese informe rápidamente eligiendo el periodo. Son del club y
-- solo las usa la cuenta del club (Modo gestión).
CREATE TABLE IF NOT EXISTS "report_templates" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "club_id" uuid NOT NULL REFERENCES "clubs"("id") ON DELETE CASCADE,
  "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "name" varchar(120) NOT NULL,
  "metrics" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "report_templates_club_id_idx" ON "report_templates" ("club_id");
--> statement-breakpoint
-- Solo se leen desde el servidor: sin acceso por la API pública.
ALTER TABLE "report_templates" ENABLE ROW LEVEL SECURITY;
