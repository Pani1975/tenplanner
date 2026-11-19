-- Horario en que el torneo ocupa sus pistas (lib/tournaments/hours.ts):
-- null = todo el día; {"mode":"daily","start","end"} = mismo horario cada
-- día; {"mode":"by_day","days":[...]} = horario por días. Con él, el torneo
-- bloquea esas pistas en Reservas de pistas y en los avisos de coincidencia.
-- Idempotente.
ALTER TABLE "tournaments" ADD COLUMN IF NOT EXISTS "play_hours" jsonb;
