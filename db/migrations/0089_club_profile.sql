-- Ficha del club en "Mi club": email de contacto, portada, fotos y vídeos
-- (enlaces), pistas de pádel e instalaciones (cafetería, aparcamiento).
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "email" varchar(255);
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "cover_image_url" text;
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "photos" jsonb;
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "videos" jsonb;
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "padel_courts" integer;
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "has_cafeteria" boolean;
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "has_parking" boolean;
