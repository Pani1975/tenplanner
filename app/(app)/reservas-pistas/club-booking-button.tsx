"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Loader2 } from "lucide-react";
import { minutesLabel } from "@/lib/bookings/availability";

const START_MINUTES = Array.from({ length: 36 }, (_, i) => 6 * 60 + i * 30); // 06:00–23:30
const DURATIONS = [30, 60, 90, 120, 180, 240, 360, 480];

/** El club reserva una pista para lo que indique (sale en morado). */
export function ClubBookingButton({
  places,
  date,
}: {
  places: { id: string; name: string }[];
  /** Día que se está viendo (YYYY-MM-DD), propuesto por defecto. */
  date: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [placeId, setPlaceId] = useState(places[0]?.id ?? "");
  const [day, setDay] = useState(date);
  const [startMinute, setStartMinute] = useState(17 * 60);
  const [duration, setDuration] = useState(60);
  const [purpose, setPurpose] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (places.length === 0) return null;

  async function save() {
    if (purpose.trim().length < 2) {
      setError("Indica para qué es la reserva.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await fetch("/api/court-bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        placeId,
        date: day,
        startMinute,
        durationMinutes: duration,
        purpose,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!res) {
      setError("Error de conexión. Inténtalo de nuevo.");
      return;
    }
    if (!res.ok) {
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      setError(json.error ?? "No se pudo reservar.");
      return;
    }
    setOpen(false);
    setPurpose("");
    router.push(`/reservas-pistas?dia=${day}`);
    router.refresh();
  }

  const field =
    "mt-1 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-violet-500";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDay(date);
          setError(null);
          setOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-full bg-violet-600 px-3.5 py-1.5 text-xs font-bold text-white hover:bg-violet-700"
      >
        <CalendarPlus className="size-3.5" />
        Reservar pista (club)
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !saving && setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-booking-title"
            className="relative max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-[28px] border border-border bg-card p-5 shadow-2xl"
          >
            <h2
              id="club-booking-title"
              className="flex items-center gap-2 text-lg font-black text-foreground"
            >
              <span className="size-3 rounded-sm bg-violet-500" />
              Reserva del club
            </h2>
            <p className="mb-4 text-xs text-muted-foreground">
              Ocupa la pista (también en la página pública de reservas).
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs font-semibold text-muted-foreground sm:col-span-2">
                Pista
                <select
                  value={placeId}
                  onChange={(e) => setPlaceId(e.target.value)}
                  className={field}
                >
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-muted-foreground sm:col-span-2">
                Día
                <input
                  type="date"
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className={field}
                />
              </label>
              <label className="block text-xs font-semibold text-muted-foreground">
                Hora de inicio
                <select
                  value={startMinute}
                  onChange={(e) => setStartMinute(Number(e.target.value))}
                  className={field}
                >
                  {START_MINUTES.map((m) => (
                    <option key={m} value={m}>
                      {minutesLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-muted-foreground">
                Duración
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className={field}
                >
                  {DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d < 60 ? `${d} min` : `${d / 60} h`.replace(".5", ",5")}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-semibold text-muted-foreground sm:col-span-2">
                ¿Para qué es?
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  maxLength={120}
                  placeholder="Mantenimiento, torneo interno, clase particular…"
                  className={field}
                />
              </label>
            </div>

            {error && (
              <p className="mt-3 text-sm font-semibold text-destructive">
                {error}
              </p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={saving}
                className="flex-1 rounded-full border border-border px-4 py-2.5 text-sm font-bold text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void save()}
                disabled={saving}
                className="inline-flex flex-[1.4] items-center justify-center gap-2 rounded-full bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Reservar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
