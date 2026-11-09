-- Reservas hechas por el propio club (no por clientes): se distinguen por
-- "kind" y en full_name va para qué es la reserva.
ALTER TABLE "court_bookings" ADD COLUMN IF NOT EXISTS "kind" varchar(16) DEFAULT 'public' NOT NULL;
