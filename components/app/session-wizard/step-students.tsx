"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Loader2,
  Search,
  UserPlus,
  Users,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentOption, WizardState } from "./types";
import { sessionCode } from "./recurrence";

interface StepStudentsProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}

interface GroupOption {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  studentIds: string[];
}

type LoadStatus = "loading" | "ready" | "unavailable";

export function StepStudents({ state, update }: StepStudentsProps) {
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"individual" | "groups">("individual");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [studentsRes, groupsRes] = await Promise.all([
          fetch("/api/students", { cache: "no-store" }),
          fetch("/api/groups?withStudents=true", { cache: "no-store" }),
        ]);
        if (!studentsRes.ok) {
          if (!cancelled) setStatus("unavailable");
          return;
        }
        const studentsPayload = (await studentsRes.json()) as {
          data?: StudentOption[];
        };
        const groupsPayload = groupsRes.ok
          ? ((await groupsRes.json()) as { data?: GroupOption[] })
          : { data: [] };
        if (cancelled) return;
        setStudents(
          Array.isArray(studentsPayload?.data) ? studentsPayload.data : []
        );
        setGroups(Array.isArray(groupsPayload?.data) ? groupsPayload.data : []);
        setStatus("ready");
      } catch {
        if (!cancelled) setStatus("unavailable");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleStudent(id: string) {
    const set = new Set(state.studentIds);
    if (set.has(id)) set.delete(id);
    else set.add(id);
    update({ studentIds: Array.from(set) });
  }

  // Los grupos se marcan de forma independiente: un grupo solo aparece
  // seleccionado si se ha pulsado él mismo, aunque comparta alumnos con otro.
  const selectedGroupIds =
    state.selectedGroupIds ?? (state.groupId ? [state.groupId] : []);

  function selectGroup(group: GroupOption) {
    const isSelected = selectedGroupIds.includes(group.id);
    const nextGroupIds = isSelected
      ? selectedGroupIds.filter((id) => id !== group.id)
      : [...selectedGroupIds, group.id];

    const set = new Set(state.studentIds);
    if (isSelected) {
      // Solo se quitan los alumnos que no estén en otro grupo aún marcado.
      const keep = new Set(
        groups
          .filter((g) => nextGroupIds.includes(g.id))
          .flatMap((g) => g.studentIds)
      );
      group.studentIds.forEach((id) => {
        if (!keep.has(id)) set.delete(id);
      });
    } else {
      group.studentIds.forEach((id) => set.add(id));
    }

    update({
      studentIds: Array.from(set),
      selectedGroupIds: nextGroupIds,
      // La sesión queda vinculada al último grupo elegido; si se desmarca,
      // pasa al último que siga marcado.
      groupId: isSelected
        ? state.groupId === group.id
          ? (nextGroupIds[nextGroupIds.length - 1] ?? null)
          : (state.groupId ?? null)
        : group.id,
      // Propone el nombre del grupo para el código de la sesión.
      ...(!isSelected && !state.groupName?.trim()
        ? {
            groupName: group.name,
            ...(state.useCodeTitle &&
            !isNaN(new Date(state.scheduledAt).getTime())
              ? { title: sessionCode(new Date(state.scheduledAt), group.name) }
              : {}),
          }
        : {}),
    });
  }

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        <span className="text-sm">Cargando alumnos…</span>
      </div>
    );
  }

  if (status === "unavailable" || students.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-12 px-4 rounded-2xl border border-dashed border-border">
        <Users className="size-10 text-muted-foreground mb-3" />
        <p className="text-sm font-semibold text-foreground mb-1">
          Aún no tienes alumnos
        </p>
        <p className="text-xs text-muted-foreground mb-5 max-w-sm">
          Puedes crear la sesión sin asignar alumnos o añadirlos más tarde.
        </p>
        <Link
          href="/students/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand/90 transition-colors"
        >
          <UserPlus className="size-4" />
          Añadir alumno
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Selecciona los alumnos para esta sesión.
        </p>
        <span className="text-xs font-semibold text-foreground tabular-nums">
          {state.studentIds.length} seleccionado
          {state.studentIds.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setTab("individual")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-colors",
            tab === "individual"
              ? "bg-background text-foreground border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="size-3.5" />
          Individual
        </button>
        <button
          type="button"
          onClick={() => setTab("groups")}
          className={cn(
            "flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-colors",
            tab === "groups"
              ? "bg-background text-foreground border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users2 className="size-3.5" />
          Por grupo
          {groups.length > 0 && (
            <span className="ml-0.5 size-4 rounded-full bg-brand/15 text-brand text-[9px] flex items-center justify-center font-bold">
              {groups.length}
            </span>
          )}
        </button>
      </div>

      {tab === "groups" ? (
        <div className="space-y-2">
          {groups.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-border rounded-xl">
              <Users2 className="size-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                No tienes grupos creados.
              </p>
              <Link
                href="/groups"
                className="mt-2 inline-block text-xs text-brand hover:underline"
              >
                Crear un grupo
              </Link>
            </div>
          ) : (
            groups.map((g) => {
              const allSelected = selectedGroupIds.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => selectGroup(g)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-colors",
                    allSelected
                      ? "border-brand bg-brand/5"
                      : "border-border bg-background hover:border-brand/40"
                  )}
                >
                  <div
                    className={cn(
                      "size-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                      allSelected ? "bg-brand border-brand" : "border-border"
                    )}
                  >
                    {allSelected && (
                      <Check className="size-3.5 text-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-foreground">
                        {g.name}
                      </p>
                      <span className="text-[10px] text-muted-foreground tabular-nums">
                        {g.memberCount}{" "}
                        {g.memberCount === 1 ? "alumno" : "alumnos"}
                      </span>
                    </div>
                    {g.description && (
                      <p className="text-xs text-muted-foreground truncate">
                        {g.description}
                      </p>
                    )}
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-4 text-muted-foreground/40 shrink-0 -rotate-90"
                    )}
                  />
                </button>
              );
            })
          )}
          {state.studentIds.length > 0 && (
            <p className="text-xs text-muted-foreground pt-1">
              {state.studentIds.length} alumno
              {state.studentIds.length !== 1 ? "s" : ""} seleccionado
              {state.studentIds.length !== 1 ? "s" : ""} en total
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar alumnos…"
              className="w-full h-10 pl-10 pr-3 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-colors text-foreground placeholder:text-muted-foreground"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {filtered.map((s) => {
              const selected = state.studentIds.includes(s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleStudent(s.id)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors",
                    selected
                      ? "border-brand bg-brand/5"
                      : "border-border bg-background hover:border-brand/40"
                  )}
                >
                  <div
                    className={cn(
                      "size-5 rounded-md border flex items-center justify-center shrink-0 transition-colors",
                      selected ? "bg-brand border-brand" : "border-border"
                    )}
                  >
                    {selected && <Check className="size-3.5 text-background" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {s.name}
                    </p>
                    {s.playerLevel && (
                      <p className="text-xs text-muted-foreground truncate">
                        {s.playerLevel}
                      </p>
                    )}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground col-span-full text-center py-6">
                Sin resultados para &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Este paso es opcional, puedes continuar sin seleccionar alumnos.
      </p>
    </div>
  );
}
