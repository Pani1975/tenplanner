-- Importar texto con Ten Planner (fase 1): una fila por importación para
-- limitar las importaciones por usuario y día. Idempotente.
CREATE TABLE IF NOT EXISTS "text_imports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL,
  "kind" varchar(16) NOT NULL,
  "chars" integer NOT NULL DEFAULT 0,
  "created_at" timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'text_imports_user_id_users_id_fk') THEN
    ALTER TABLE "text_imports" ADD CONSTRAINT "text_imports_user_id_users_id_fk"
      FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "text_imports_user_created_idx" ON "text_imports" USING btree ("user_id","created_at");
--> statement-breakpoint
-- Solo la aplicación (conexión directa) accede a la tabla.
ALTER TABLE "text_imports" ENABLE ROW LEVEL SECURITY;
