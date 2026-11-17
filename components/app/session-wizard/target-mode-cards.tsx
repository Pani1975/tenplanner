"use client";

import { useRouter } from "next/navigation";
import { BookOpen, History, Pencil, Sparkles } from "lucide-react";
import { MONTAR } from "@/lib/session-engine/messages";
import {
  saveTarget,
  targetToParams,
  type SessionTarget,
} from "@/lib/session-target";

const CARD =
  "group rounded-lg border border-[#050505]/10 bg-white p-5 text-left shadow-[0_12px_36px_rgba(5,5,5,0.04)] transition-colors hover:border-[#D6FF38]/70 hover:bg-[#D6FF38]/10 dark:border-white/10 dark:bg-white/[0.045]";

interface TargetModeCardsProps {
  target: SessionTarget;
  /** Quién, cuándo y cuántas pistas, en texto. */
  label: string;
}

/**
 * Segundo paso de «Nueva sesión»: con el destino ya elegido (para quién,
 * cuándo, pistas), se elige cómo montar la sesión. Cada camino parte de ese
 * destino, así que el nombre sale solo.
 */
export function TargetModeCards({ target, label }: TargetModeCardsProps) {
  const router = useRouter();
  const withLabel: SessionTarget = { ...target, label };

  function go(path: string, extra?: Record<string, string>, keep = false) {
    saveTarget(withLabel);
    const qs = targetToParams(target);
    for (const [k, v] of Object.entries(extra ?? {})) qs.set(k, v);
    router.push(keep ? `${path}?${qs.toString()}` : path);
  }

  return (
    <div className="flex flex-col gap-5 pt-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D6FF38]/60 bg-[#D6FF38]/15 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/60">
            Sesión para
          </p>
          <p className="text-sm font-semibold text-foreground">{label}</p>
        </div>
        <button
          type="button"
          onClick={() => router.push("/sessions/new")}
          className="rounded-full border border-foreground/20 bg-background px-4 py-2 text-xs font-bold text-foreground hover:bg-muted"
        >
          Cambiar
        </button>
      </section>

      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        ¿Cómo la montas?
      </p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <button
          type="button"
          onClick={() => go("/sessions/new/montar", {}, true)}
          className={CARD}
        >
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[#D6FF38]/20">
            <Sparkles className="size-4 text-brand" />
          </div>
          <p className="font-heading text-base text-foreground group-hover:text-brand">
            {MONTAR.title}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Te propone la clase con su nivel y su historial.
          </p>
        </button>

        <button type="button" onClick={() => go("/classes")} className={CARD}>
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[#D6FF38]/20">
            <BookOpen className="size-4 text-brand" />
          </div>
          <p className="font-heading text-base text-foreground group-hover:text-brand">
            Elegir del catálogo
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Todas las clases, las de la biblioteca pública o las de tu club, y
            las añades a esta sesión.
          </p>
        </button>

        <button
          type="button"
          onClick={() => go("/sessions?filter=past")}
          className={CARD}
        >
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[#D6FF38]/20">
            <History className="size-4 text-brand" />
          </div>
          <p className="font-heading text-base text-foreground group-hover:text-brand">
            Reutilizar una sesión pasada
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Copia el plan de una sesión que ya impartiste.
          </p>
        </button>

        <button
          type="button"
          onClick={() => go("/sessions/new", { modo: "cero", target: "1" }, true)}
          className={CARD}
        >
          <div className="mb-3 flex size-10 items-center justify-center rounded-full bg-[#D6FF38]/20">
            <Pencil className="size-4 text-brand" />
          </div>
          <p className="font-heading text-base text-foreground group-hover:text-brand">
            Crear desde cero
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Bloque a bloque, con el grupo y el día ya puestos.
          </p>
        </button>
      </div>
    </div>
  );
}
