"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarCheck,
  Check,
  Copy,
  ExternalLink,
  Link2,
  Loader2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { minutesLabel } from "@/lib/bookings/availability";

export type BookingPlace = {
  id: string;
  name: string;
  bookingEnabled: boolean;
  bookingOpenMinute: number;
  bookingCloseMinute: number;
};

export type UpcomingBooking = {
  id: string;
  placeName: string;
  startAt: string;
  durationMinutes: number;
  fullName: string;
  /** "club" = reserva hecha por el propio club (fullName = para qué es). */
  kind?: string;
};

const HALF_HOURS = Array.from({ length: 49 }, (_, i) => i * 30);
const DATE_FMT = new Intl.DateTimeFormat("es-ES", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "Atlantic/Canary",
});
const TIME_FMT = new Intl.DateTimeFormat("es-ES", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Atlantic/Canary",
});

/**
 * Reserva pública de pistas: qué pistas se pueden reservar y en qué horario,
 * el enlace para compartir y las próximas reservas.
 */
export function BookingsPanel({
  places: initialPlaces,
  bookings,
  bookingPath: initialPath,
  origin,
}: {
  places: BookingPlace[];
  bookings: UpcomingBooking[];
  bookingPath: string | null;
  /** Dirección de la web (p. ej. https://www.tenplanner.com). */
  origin: string;
}) {
  const router = useRouter();
  const [places, setPlaces] = useState(initialPlaces);
  const [path, setPath] = useState(initialPath);
  const [saving, setSaving] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const url = path ? `${origin}${path}` : null;

  async function updatePlace(id: string, patch: Partial<BookingPlace>) {
    const prev = places;
    setPlaces((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
    setSaving(id);
    setError(null);
    const res = await fetch(`/api/places/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => null);
    if (!res?.ok) {
      setPlaces(prev);
      setError("No se pudo guardar. Revisa el horario (mínimo una hora).");
    }
    setSaving(null);
  }

  async function createLink() {
    setError(null);
    const res = await fetch("/api/account/booking-link", {
      method: "POST",
    }).catch(() => null);
    if (!res?.ok) {
      setError("No se pudo crear el enlace.");
      return;
    }
    const json = (await res.json()) as { data: { path: string } };
    setPath(json.data.path);
  }

  async function copyLink() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso para el portapapeles: el enlace se ve y se puede copiar.
    }
  }

  async function cancelBooking(id: string) {
    setCancelling(id);
    const res = await fetch(`/api/court-bookings/${id}`, {
      method: "DELETE",
    }).catch(() => null);
    setCancelling(null);
    if (res?.ok) router.refresh();
    else setError("No se pudo cancelar la reserva.");
  }

  const anyEnabled = places.some((p) => p.bookingEnabled);

  return (
    <section className="mb-6 space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/15">
          <CalendarCheck className="size-4 text-foreground" />
        </div>
        <div>
          <h2 className="font-semibold text-foreground">
            Reserva pública de pistas
          </h2>
          <p className="text-xs text-muted-foreground">
            Cualquiera con el enlace puede reservar una pista libre poniendo su
            nombre y apellidos. Las horas con sesiones salen como ocupadas.
          </p>
        </div>
      </div>

      {/* Enlace */}
      <div className="rounded-xl border border-border bg-background p-3">
        {path ? (
          <div className="flex flex-wrap items-center gap-2">
            <Link2 className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-foreground">
              {url}
            </span>
            <button
              type="button"
              onClick={() => void copyLink()}
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              {copied ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copied ? "Copiado" : "Copiar"}
            </button>
            <a
              href={path}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
            >
              <ExternalLink className="size-3.5" />
              Abrir
            </a>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void createLink()}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand px-4 py-2 text-xs font-black text-brand-foreground"
          >
            <Link2 className="size-3.5" />
            Crear enlace para reservar
          </button>
        )}
        {path && !anyEnabled && (
          <p className="mt-2 text-[11px] text-amber-600">
            Activa al menos una pista para que se pueda reservar.
          </p>
        )}
      </div>

      {/* Pistas */}
      {places.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Da de alta tus pistas abajo para poder abrirlas a reservas.
        </p>
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border">
          {places.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5"
            >
              <label className="flex min-w-0 flex-1 items-center gap-2 text-sm font-semibold text-foreground">
                <input
                  type="checkbox"
                  checked={p.bookingEnabled}
                  onChange={(e) =>
                    void updatePlace(p.id, { bookingEnabled: e.target.checked })
                  }
                  className="size-4 accent-[var(--brand)]"
                />
                <span className="truncate">{p.name}</span>
                {saving === p.id && (
                  <Loader2 className="size-3 animate-spin text-muted-foreground" />
                )}
              </label>
              <div
                className={cn(
                  "flex items-center gap-1.5 text-xs text-muted-foreground",
                  !p.bookingEnabled && "opacity-50"
                )}
              >
                <select
                  aria-label={`Abre ${p.name}`}
                  value={p.bookingOpenMinute}
                  disabled={!p.bookingEnabled}
                  onChange={(e) =>
                    void updatePlace(p.id, {
                      bookingOpenMinute: Number(e.target.value),
                    })
                  }
                  className="rounded-lg border border-border bg-background px-2 py-1 text-foreground"
                >
                  {HALF_HOURS.slice(0, -2).map((m) => (
                    <option key={m} value={m}>
                      {minutesLabel(m)}
                    </option>
                  ))}
                </select>
                a
                <select
                  aria-label={`Cierra ${p.name}`}
                  value={p.bookingCloseMinute}
                  disabled={!p.bookingEnabled}
                  onChange={(e) =>
                    void updatePlace(p.id, {
                      bookingCloseMinute: Number(e.target.value),
                    })
                  }
                  className="rounded-lg border border-border bg-background px-2 py-1 text-foreground"
                >
                  {HALF_HOURS.slice(2).map((m) => (
                    <option key={m} value={m}>
                      {m === 1440 ? "24:00" : minutesLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="text-xs font-semibold text-destructive">{error}</p>
      )}

      {/* Próximas reservas */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
            Próximas reservas
          </h3>
          <a
            href="/reservas-pistas"
            className="text-xs font-semibold text-foreground underline-offset-2 hover:underline"
          >
            Ver ocupación por día
          </a>
        </div>
        {bookings.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Todavía no hay reservas.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {bookings.map((b) => {
              const start = new Date(b.startAt);
              const end = new Date(
                start.getTime() + b.durationMinutes * 60_000
              );
              return (
                <li
                  key={b.id}
                  className="flex items-center gap-3 rounded-xl border border-border px-3 py-2 text-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground">
                      {b.kind === "club" ? (
                        <span className="mr-1.5 rounded bg-violet-500/20 px-1.5 py-0.5 text-[10px] font-bold uppercase text-violet-700 dark:text-violet-300">
                          Club
                        </span>
                      ) : null}
                      {b.fullName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {b.placeName} · {DATE_FMT.format(start)} ·{" "}
                      {TIME_FMT.format(start)}–{TIME_FMT.format(end)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void cancelBooking(b.id)}
                    disabled={cancelling === b.id}
                    className="inline-flex items-center gap-1 rounded-full border border-destructive/30 px-2.5 py-1 text-xs font-semibold text-destructive hover:bg-destructive/10 disabled:opacity-50"
                  >
                    {cancelling === b.id ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <X className="size-3" />
                    )}
                    Cancelar
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
