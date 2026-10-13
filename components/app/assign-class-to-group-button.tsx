"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduleChoiceStep } from "./schedule-choice-step";
import type { GroupScheduleEntry } from "@/lib/groups/schedule";

interface ClassOption {
  id: string;
  name: string;
  duracionMinutes: number;
  isLibrary: boolean;
  authorName: string | null;
}

/**
 * Botón "Asignar clase" en la ficha de grupo: deja elegir una clase
 * (propia o de la biblioteca) y lleva al wizard de sesión con la clase y el
 * grupo ya precargados — ahí solo falta confirmar el día y la hora (el
 * resto, título, alumnos y contenido, ya vienen rellenos). Si el grupo
 * tiene horario habitual, antes pregunta si va al día que toca o es una
 * clase suelta.
 */
export function AssignClassToGroupButton({
  groupId,
  weeklySchedule,
}: {
  groupId: string;
  weeklySchedule?: GroupScheduleEntry[] | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [classesList, setClassesList] = useState<ClassOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [pickedClassId, setPickedClassId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ tab: "all" });
        if (query.trim()) params.set("q", query.trim());
        const res = await fetch(`/api/classes?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => ({}))) as {
          data?: ClassOption[];
        };
        if (!cancelled) {
          setClassesList(Array.isArray(data.data) ? data.data : []);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query]);

  function pick(classId: string) {
    if (weeklySchedule && weeklySchedule.length > 0) {
      setPickedClassId(classId);
      return;
    }
    goToSession(classId);
  }

  function goToSession(classId: string, scheduledAt?: string) {
    setNavigatingTo(classId);
    const qs = new URLSearchParams({ fromClass: classId, group: groupId });
    if (scheduledAt) qs.set("at", scheduledAt);
    router.push(`/sessions/new?${qs.toString()}`);
  }

  function close() {
    setOpen(false);
    setQuery("");
    setPickedClassId(null);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#050505]/12 px-4 py-2 text-sm font-bold text-foreground/70 transition-colors hover:border-[#D6FF38] hover:text-foreground dark:border-white/10"
      >
        <BookOpen className="size-4" />
        Asignar clase
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={close}
          />
          <div className="relative w-full overflow-hidden rounded-t-3xl border border-foreground/15 bg-background shadow-2xl sm:max-w-md sm:rounded-3xl">
            <div className="flex items-center justify-between border-b border-foreground/10 px-5 pb-4 pt-5">
              <div className="min-w-0 flex items-center gap-2">
                {pickedClassId && (
                  <button
                    type="button"
                    onClick={() => setPickedClassId(null)}
                    aria-label="Volver"
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                )}
                <div className="min-w-0">
                  <p className="mb-0.5 flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">
                    <Sparkles className="size-3" />
                    Asignar clase al grupo
                  </p>
                  <h2 className="truncate text-lg font-black text-foreground">
                    {pickedClassId ? "¿Qué día?" : "Elige una clase"}
                  </h2>
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Cerrar"
                className="flex size-8 items-center justify-center rounded-xl text-foreground/40 hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            {pickedClassId ? (
              <ScheduleChoiceStep
                schedule={weeklySchedule ?? []}
                busy={!!navigatingTo}
                onChoose={(scheduledAt) =>
                  goToSession(pickedClassId, scheduledAt)
                }
              />
            ) : (
              <>
                <div className="border-b border-foreground/10 px-4 py-3">
                  <div className="flex items-center gap-2 rounded-xl border border-foreground/15 bg-foreground/[0.02] px-3 py-2">
                    <Search className="size-4 shrink-0 text-foreground/35" />
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="Buscar clase..."
                      className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-foreground/30 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="max-h-[55vh] space-y-2 overflow-y-auto p-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="size-5 animate-spin text-foreground/30" />
                    </div>
                  ) : classesList.length === 0 ? (
                    <p className="py-6 text-center text-sm text-foreground/60">
                      No se han encontrado clases.
                    </p>
                  ) : (
                    classesList.map((cls) => (
                      <button
                        key={cls.id}
                        type="button"
                        onClick={() => pick(cls.id)}
                        disabled={!!navigatingTo}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                          "border-foreground/10 hover:border-foreground/25",
                          navigatingTo === cls.id && "opacity-60"
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-foreground">
                            {cls.name}
                          </span>
                          <span className="block text-xs text-foreground/45">
                            {cls.duracionMinutes} min
                            {cls.isLibrary
                              ? " · Biblioteca"
                              : cls.authorName
                                ? ` · ${cls.authorName}`
                                : ""}
                          </span>
                        </span>
                        {navigatingTo === cls.id && (
                          <Loader2 className="size-4 animate-spin text-foreground/40" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
