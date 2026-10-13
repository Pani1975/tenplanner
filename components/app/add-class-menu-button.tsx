"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarPlus,
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Users,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScheduleChoiceStep } from "./schedule-choice-step";
import type { GroupScheduleEntry } from "@/lib/groups/schedule";

interface GroupOption {
  id: string;
  name: string;
  memberCount: number;
  weeklySchedule: GroupScheduleEntry[] | null;
}

/**
 * Botón "Añadir" de la ficha de clase: deja elegir si la clase se usa para
 * una sesión nueva (sin grupo) o se asigna directamente a uno de los
 * grupos del monitor. En ambos casos se abre el wizard de sesión con la
 * clase precargada; si se elige grupo, también llega el grupo (y sus
 * alumnos) precargados, y solo falta decir el día y la hora.
 */
export function AddClassMenuButton({ classId }: { classId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"menu" | "groups" | "schedule">("menu");
  const [query, setQuery] = useState("");
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [navigatingTo, setNavigatingTo] = useState<string | null>(null);
  const [pickedGroup, setPickedGroup] = useState<GroupOption | null>(null);

  useEffect(() => {
    if (!open || view !== "groups") return;
    let cancelled = false;
    async function loadGroups() {
      setLoading(true);
      try {
        const res = await fetch("/api/groups", { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as {
          data?: GroupOption[];
        };
        if (!cancelled) setGroups(Array.isArray(data.data) ? data.data : []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadGroups();
    return () => {
      cancelled = true;
    };
  }, [open, view]);

  function close() {
    setOpen(false);
    setView("menu");
    setQuery("");
    setPickedGroup(null);
  }

  function pickGroup(group: GroupOption) {
    if (group.weeklySchedule && group.weeklySchedule.length > 0) {
      setPickedGroup(group);
      setView("schedule");
      return;
    }
    goToSession(group.id);
  }

  function goToSession(groupId?: string, scheduledAt?: string) {
    setNavigatingTo(groupId ?? "new-session");
    const qs = new URLSearchParams({ fromClass: classId });
    if (groupId) qs.set("group", groupId);
    if (scheduledAt) qs.set("at", scheduledAt);
    router.push(`/sessions/new?${qs.toString()}`);
  }

  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(query.trim().toLowerCase())
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-[#050505]/12 px-3 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:border-[#D6FF38] hover:text-foreground dark:border-white/10"
      >
        <Plus className="size-3.5" />
        Añadir
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
                {view !== "menu" && (
                  <button
                    type="button"
                    onClick={() =>
                      view === "schedule" ? setView("groups") : setView("menu")
                    }
                    aria-label="Volver"
                    className="flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground/50 hover:bg-foreground/10 hover:text-foreground"
                  >
                    <ArrowLeft className="size-4" />
                  </button>
                )}
                <h2 className="truncate text-lg font-black text-foreground">
                  {view === "menu"
                    ? "Añadir esta clase a..."
                    : view === "groups"
                      ? "Elige un grupo"
                      : "¿Qué día?"}
                </h2>
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

            {view === "menu" ? (
              <div className="space-y-2 p-4">
                <button
                  type="button"
                  onClick={() => goToSession()}
                  disabled={!!navigatingTo}
                  className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 px-4 py-3.5 text-left transition-colors hover:border-foreground/25"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#D6FF38]/20 text-brand">
                    <CalendarPlus className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-foreground">
                      Sesión
                    </span>
                    <span className="block text-xs text-foreground/45">
                      Crea una sesión suelta a partir de esta clase.
                    </span>
                  </span>
                  {navigatingTo === "new-session" ? (
                    <Loader2 className="size-4 shrink-0 animate-spin text-foreground/40" />
                  ) : (
                    <ChevronRight className="size-4 shrink-0 text-foreground/30" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setView("groups")}
                  className="flex w-full items-center gap-3 rounded-2xl border border-foreground/10 px-4 py-3.5 text-left transition-colors hover:border-foreground/25"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#D6FF38]/20 text-brand">
                    <Users className="size-4.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold text-foreground">
                      Grupo
                    </span>
                    <span className="block text-xs text-foreground/45">
                      Asigna esta clase a uno de tus grupos.
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-foreground/30" />
                </button>
              </div>
            ) : view === "schedule" && pickedGroup ? (
              <ScheduleChoiceStep
                schedule={pickedGroup.weeklySchedule ?? []}
                busy={!!navigatingTo}
                onChoose={(scheduledAt) =>
                  goToSession(pickedGroup.id, scheduledAt)
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
                      placeholder="Buscar grupo..."
                      className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-foreground/30 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="max-h-[55vh] space-y-2 overflow-y-auto p-4">
                  {loading ? (
                    <div className="flex items-center justify-center py-10">
                      <Loader2 className="size-5 animate-spin text-foreground/30" />
                    </div>
                  ) : filteredGroups.length === 0 ? (
                    <p className="py-6 text-center text-sm text-foreground/60">
                      {groups.length === 0
                        ? "Aún no tienes grupos creados."
                        : "No se han encontrado grupos."}
                    </p>
                  ) : (
                    filteredGroups.map((g) => (
                      <button
                        key={g.id}
                        type="button"
                        onClick={() => pickGroup(g)}
                        disabled={!!navigatingTo}
                        className={cn(
                          "flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                          "border-foreground/10 hover:border-foreground/25",
                          navigatingTo === g.id && "opacity-60"
                        )}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-foreground">
                            {g.name}
                          </span>
                          <span className="block text-xs text-foreground/45">
                            {g.memberCount}{" "}
                            {g.memberCount === 1 ? "alumno" : "alumnos"}
                          </span>
                        </span>
                        {navigatingTo === g.id && (
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
