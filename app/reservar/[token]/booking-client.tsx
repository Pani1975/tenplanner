"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BOOKING_DURATIONS,
  availabilityGrid,
  isPlaceFree,
  isValidFullName,
  localToUtc,
  minutesLabel,
  type BookablePlace,
} from "@/lib/bookings/availability";

type ApiPlace = {
  id: string;
  name: string;
  openMinute: number;
  closeMinute: number;
  busy: { start: string; end: string }[];
};

const WEEKDAY = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  timeZone: "UTC",
});
const DAY_LONG = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

function dayDate(dateStr: string) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function BookingClient({
  token,
  days,
}: {
  token: string;
  days: string[];
}) {
  const [date, setDate] = useState(days[0]);
  const [duration, setDuration] = useState<number>(90);
  const [minute, setMinute] = useState<number | null>(null);
  const [placeId, setPlaceId] = useState<string | null>(null);
  const [places, setPlaces] = useState<BookablePlace[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [fullName, setFullName] = useState("");
  const [website, setWebsite] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<{
    placeName: string;
    date: string;
    minute: number;
    duration: number;
  } | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(
    async (day: string) => {
      setPlaces(null);
      setLoadError(false);
      try {
        const res = await fetch(
          `/api/public/reservas/${token}?date=${encodeURIComponent(day)}`,
          { cache: "no-store" }
        );
        if (!res.ok) throw new Error();
        const json = (await res.json()) as { data: { places: ApiPlace[] } };
        setNow(new Date());
        setPlaces(
          json.data.places.map((p) => ({
            ...p,
            busy: p.busy.map((b) => ({
              start: new Date(b.start),
              end: new Date(b.end),
            })),
          }))
        );
      } catch {
        setLoadError(true);
      }
    },
    [token]
  );

  useEffect(() => {
    void load(date);
  }, [date, load]);

  const grid = useMemo(
    () => (places ? availabilityGrid(places, date, duration, now) : []),
    [places, date, duration, now]
  );
  const freePlaces = useMemo(() => {
    if (!places || minute === null) return [];
    return places.filter((p) => isPlaceFree(p, date, minute, duration, now));
  }, [places, minute, date, duration, now]);

  // Si la hora o la pista elegidas dejan de estar libres al cambiar algo.
  const selectedMinute =
    minute !== null &&
    grid.some((r) => r.minute === minute && r.freePlaceIds.length > 0)
      ? minute
      : null;
  const selectedPlace =
    selectedMinute !== null
      ? (freePlaces.find((p) => p.id === placeId) ?? null)
      : null;

  async function book() {
    if (!selectedPlace || selectedMinute === null) return;
    if (!isValidFullName(fullName)) {
      setError("Escribe tu nombre y apellidos.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/reservas/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          placeId: selectedPlace.id,
          start: localToUtc(date, selectedMinute).toISOString(),
          durationMinutes: duration,
          fullName,
          website,
        }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          res.status === 429
            ? "Demasiados intentos. Prueba de nuevo más tarde."
            : (json.error ?? "No se pudo reservar. Inténtalo de nuevo.")
        );
        if (res.status === 409) void load(date);
        return;
      }
      setBooked({
        placeName: selectedPlace.name,
        date,
        minute: selectedMinute,
        duration,
      });
    } catch {
      setError("Error de conexión. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  if (booked) {
    return (
      <div className="rounded-[28px] border border-[#050505]/10 bg-white p-6 text-center dark:border-white/10 dark:bg-white/5">
        <div className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-[#D6FF38] text-[#050505]">
          <CheckCircle2 className="size-7" />
        </div>
        <h2 className="text-2xl font-black">¡Pista reservada!</h2>
        <p className="mt-2 text-sm text-[#050505]/70 dark:text-white/70">
          {booked.placeName} · {DAY_LONG.format(dayDate(booked.date))}
          <br />
          de {minutesLabel(booked.minute)} a{" "}
          {minutesLabel(booked.minute + booked.duration)}
        </p>
        <p className="mt-3 text-xs text-[#050505]/55 dark:text-white/50">
          Haz una captura de pantalla para tenerla a mano.
        </p>
        <button
          type="button"
          onClick={() => {
            setBooked(null);
            setMinute(null);
            setPlaceId(null);
            setFullName("");
            void load(date);
          }}
          className="mt-5 rounded-full border border-[#050505]/15 px-5 py-2.5 text-sm font-black dark:border-white/15"
        >
          Hacer otra reserva
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Días */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {days.map((d) => {
          const active = d === date;
          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                setDate(d);
                setMinute(null);
                setPlaceId(null);
              }}
              aria-pressed={active}
              className="flex flex-col items-center gap-1.5"
            >
              <span className="text-[11px] font-bold uppercase text-[#050505]/60 dark:text-white/60">
                {WEEKDAY.format(dayDate(d)).replace(".", "")}
              </span>
              <span
                className={cn(
                  "grid size-11 place-items-center rounded-full border text-base font-black transition-colors",
                  active
                    ? "border-[#050505] bg-[#050505] text-white dark:border-white dark:bg-white dark:text-[#050505]"
                    : "border-[#050505]/15 bg-white dark:border-white/15 dark:bg-white/5"
                )}
              >
                {dayDate(d).getUTCDate()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Duración */}
      <div className="grid grid-cols-3 gap-2">
        {BOOKING_DURATIONS.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDuration(d)}
            aria-pressed={duration === d}
            className={cn(
              "rounded-lg border py-2.5 text-base font-black transition-colors",
              duration === d
                ? "border-[#050505] bg-[#050505] text-white dark:border-white dark:bg-white dark:text-[#050505]"
                : "border-[#050505]/15 bg-white dark:border-white/15 dark:bg-white/5"
            )}
          >
            {d} min
          </button>
        ))}
      </div>

      {/* Horas */}
      {loadError ? (
        <p className="text-sm text-red-600">
          No se pudo cargar la disponibilidad.{" "}
          <button
            type="button"
            className="font-bold underline"
            onClick={() => void load(date)}
          >
            Reintentar
          </button>
        </p>
      ) : places === null ? (
        <div className="flex justify-center py-8">
          <Loader2 className="size-6 animate-spin text-[#050505]/40" />
        </div>
      ) : grid.length === 0 ? (
        <p className="text-sm text-[#050505]/60">No hay horas para este día.</p>
      ) : (
        <div className="grid grid-cols-5 gap-1.5">
          {grid.map((row) => {
            const free = row.freePlaceIds.length > 0;
            const active = selectedMinute === row.minute;
            return (
              <button
                key={row.minute}
                type="button"
                disabled={!free}
                onClick={() => {
                  setMinute(row.minute);
                  setPlaceId(
                    row.freePlaceIds.length === 1 ? row.freePlaceIds[0] : null
                  );
                  setError(null);
                }}
                aria-pressed={active}
                aria-label={`${row.label}${free ? "" : ", ocupado"}`}
                className={cn(
                  "rounded-md border py-2.5 text-[15px] font-bold tabular-nums transition-colors",
                  active
                    ? "border-[#050505] bg-[#050505] text-white dark:border-white dark:bg-white dark:text-[#050505]"
                    : free
                      ? "border-[#050505]/20 bg-white dark:border-white/20 dark:bg-white/5"
                      : "cursor-not-allowed border-[#050505]/8 bg-white/60 text-[#050505]/25 line-through dark:border-white/8 dark:bg-white/[0.02] dark:text-white/25"
                )}
              >
                {row.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Pistas libres a esa hora */}
      {selectedMinute !== null && (
        <section className="space-y-3">
          <h2 className="text-xl font-black">Reserva una pista</h2>
          <p className="text-sm text-[#050505]/60 dark:text-white/60">
            {DAY_LONG.format(dayDate(date))} · {minutesLabel(selectedMinute)}–
            {minutesLabel(selectedMinute + duration)}
          </p>
          <div className="space-y-2">
            {freePlaces.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlaceId(p.id)}
                aria-pressed={selectedPlace?.id === p.id}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left transition-colors dark:bg-white/5",
                  selectedPlace?.id === p.id
                    ? "border-[#050505] ring-2 ring-[#050505] dark:border-white dark:ring-white"
                    : "border-[#050505]/12 dark:border-white/12"
                )}
              >
                <MapPin className="size-4 shrink-0" />
                <span className="font-bold">{p.name}</span>
              </button>
            ))}
          </div>

          {selectedPlace && (
            <div className="space-y-3 rounded-2xl border border-[#050505]/10 bg-white p-4 dark:border-white/10 dark:bg-white/5">
              <label className="block">
                <span className="text-sm font-black">Nombre y apellidos</span>
                <input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  autoComplete="name"
                  maxLength={120}
                  placeholder="Ana López García"
                  className="mt-1.5 h-12 w-full rounded-xl border border-[#050505]/15 bg-[#F4F4F1] px-4 text-base outline-none focus:border-[#050505] dark:border-white/15 dark:bg-white/5"
                />
              </label>
              {/* Campo trampa para robots (oculto a las personas). */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="absolute -left-[9999px] h-0 w-0 opacity-0"
                name="website"
              />
              {error && (
                <p className="text-sm font-semibold text-red-600">{error}</p>
              )}
              <button
                type="button"
                onClick={() => void book()}
                disabled={saving}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#050505] text-base font-black text-white disabled:opacity-60 dark:bg-white dark:text-[#050505]"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Reservar {selectedPlace.name}
              </button>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
