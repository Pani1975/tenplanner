-- Quién hizo la reserva del club (el administrador o un monitor del club).
-- Así el monitor ve y cancela sus propias reservas en las pistas del club.
-- Nulo en las reservas antiguas y en las públicas. Idempotente.
ALTER TABLE "court_bookings" ADD COLUMN IF NOT EXISTS "created_by" uuid REFERENCES "users"("id") ON DELETE SET NULL;
