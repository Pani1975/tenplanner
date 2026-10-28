ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "locality" varchar(120);
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "locality_lat" double precision;
--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN IF NOT EXISTS "locality_lng" double precision;
