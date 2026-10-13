"use client";

import { CalendarClock, CalendarPlus, ChevronRight, Loader2 } from "lucide-react";
import {
  nextScheduleOccurrence,
  toLocalDateTimeInput,
  type GroupScheduleEntry,
} from "@/lib/groups/schedule";

const DATE_LABEL_FORMAT = new Intl.DateTimeFormat("es-ES", {
  weekday: "long",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/**
 * Paso intermedio al asignar una clase a un grupo con horario habitual
 * configurado: ¿va al día que toca normalmente, o es una clase suelta en
 * otro día? Se muestra entre elegir grupo/clase y llegar al wizard de
 * sesión. `onChoose` recibe la fecha/hora ya calculada ("día habitual") o
 * undefined (clase suelta, se elige libremente en el wizard).
 */
export function ScheduleChoiceStep({
  schedule,
  busy,
  onChoose,
}: {
  schedule: GroupScheduleEntry[];
  busy?: boolean;
  onChoose: (scheduledAt: string | undefined) => void;
}) {
  const next = nextScheduleOccurrence(schedule);

  return (
    <div className="space-y-2 p-4">
      <button
        type="button"
        disabled={busy || !next}
        onClick={() => next && onChoose(toLocalDateTimeInput(next))}
        className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 px-4 py-3.5 text-left transition-colors hover:border-foreground/25 disabled:opacity-60"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#D6FF38]/20 text-brand">
          <CalendarClock className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">
            Día habitual del grupo
          </span>
          <span className="block text-xs capitalize text-foreground/45">
            {next
              ? DATE_LABEL_FORMAT.format(next)
              : "Sin horario configurado"}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-foreground/30" />
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={() => onChoose(undefined)}
        className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 px-4 py-3.5 text-left transition-colors hover:border-foreground/25 disabled:opacity-60"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#D6FF38]/20 text-brand">
          <CalendarPlus className="size-4.5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">
            Clase suelta / día extra
          </span>
          <span className="block text-xs text-foreground/45">
            Elige libremente el día y la hora en el siguiente paso.
          </span>
        </span>
        {busy ? (
          <Loader2 className="size-4 shrink-0 animate-spin text-foreground/40" />
        ) : (
          <ChevronRight className="size-4 shrink-0 text-foreground/30" />
        )}
      </button>
    </div>
  );
}
