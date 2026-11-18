"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronDown,
  Loader2,
  Plus,
  Search,
  UserPlus,
  Users,
  Users2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudentOption, WizardState } from "./types";
import type { GroupScheduleEntry } from "@/lib/groups/schedule";
import { useTranslations } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";

// Niveles que se ofrecen al dar de alta a un alumno (los mismos que en su ficha).
const NEW_STUDENT_LEVELS = [
  { id: "descubrimiento", label: "Descubrimiento", desc: "4-6 años" },
  { id: "desarrollo", label: "Desarrollo", desc: "6-8 años" },
  { id: "consolidacion", label: "Consolidación", desc: "8-10 años" },
  { id: "especializacion", label: "Especialización", desc: "10-12 años" },
  { id: "precompeticion", label: "Precompetición", desc: "12-14 años" },
  { id: "competicion", label: "Competición", desc: "14-18 años" },
];

interface StepStudentsProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  /** Se llama al elegir un grupo (p. ej. para proponer su próximo entreno). */
  onGroupPicked?: (group: {
    id: string;
    name: string;
    weeklySchedule?: GroupScheduleEntry[] | null;
  }) => void;
}

interface GroupOption {
  id: string;
  name: string;
  weeklySchedule?: GroupScheduleEntry[] | null;
  description: string | null;
  memberCount: number;
  studentIds: string[];
}

type LoadStatus = "loading" | "ready" | "unavailable";

export function StepStudents({
  state,
  update,
  onGroupPicked,
}: StepStudentsProps) {
  const term = useTerm();
  const tx = useTranslations("ui.s_sessionwizard_stepstudents");
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"individual" | "groups">("groups");
  // Alta rápida de un alumno que aún no está en el sistema.
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLevel, setNewLevel] = useState("");
  const [savingNew, setSavingNew] = useState(false);
  const [newError, setNewError] = useState<string | null>(null);

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
        // Sin grupos creados, se empieza por la clase suelta (alumnos sueltos).
        if (!Array.isArray(groupsPayload?.data) || groupsPayload.data.length === 0)
          setTab("individual");
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

  async function createStudent() {
    const name = newName.trim();
    if (!name) {
      setNewError(tx("escribeElNombreDel"));
      return;
    }
    setSavingNew(true);
    setNewError(null);
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, playerLevel: newLevel || null }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { id?: string; name?: string; playerLevel?: string | null };
      };
      if (!res.ok || !json.data?.id) {
        setNewError(tx("noSePudoDar"));
        return;
      }
      const created: StudentOption = {
        id: json.data.id,
        name: json.data.name ?? name,
        playerLevel: json.data.playerLevel ?? (newLevel || null),
      } as StudentOption;
      setStudents((prev) => [...prev, created]);
      // Queda elegido para la sesión, en la pestaña de clase suelta.
      update({
        studentIds: Array.from(new Set([...state.studentIds, created.id])),
      });
      setTab("individual");
      setCreating(false);
      setNewName("");
      setNewLevel("");
    } catch {
      setNewError(tx("errorDeRedIntentalo"));
    } finally {
      setSavingNew(false);
    }
  }

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
    const nextGroupId = isSelected
      ? state.groupId === group.id
        ? (nextGroupIds[nextGroupIds.length - 1] ?? null)
        : (state.groupId ?? null)
      : group.id;

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
      groupId: nextGroupId,
      // El nombre del grupo para el nombre de la sesión (sin grupo: vacío,
      // y el nombre lleva SG).
      groupName: groups.find((g) => g.id === nextGroupId)?.name ?? "",
    });
    if (!isSelected) onGroupPicked?.(group);
  }

  const filtered = students.filter((s) =>
    s.name.toLowerCase().includes(search.toLowerCase())
  );

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="size-5 animate-spin mr-2" />
        <span className="text-sm">{tx("cargandoAlumnos")}</span>
      </div>
    );
  }

  if (status === "unavailable") {
    return (
      <div className="flex flex-col items-center text-center py-12 px-4 rounded-2xl border border-dashed border-border">
        <Users className="size-10 text-muted-foreground mb-3" />
        <p className="text-sm font-semibold text-foreground mb-1">
          {tx("aunNoTienesAlumnos")}
        </p>
        <p className="text-xs text-muted-foreground mb-5 max-w-sm">
          {tx("puedesCrearLaSesion")}
        </p>
        <Link
          href="/students/new"
          className="inline-flex items-center gap-2 h-9 px-4 rounded-xl bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand/90 transition-colors"
        >
          <UserPlus className="size-4" />
          {tx("anadirAlumno")}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {tx("seleccionaLosAlumnosPara")}
        </p>
        <span className="text-xs font-semibold text-foreground tabular-nums">
          {tx("v1SeleccionadoV2", { v1: state.studentIds.length, v2: state.studentIds.length !== 1 ? "s" : "" })}
        </span>
      </div>

      {/* Nuevo alumno: alguien que aún no está dado de alta */}
      {creating ? (
        <div className="space-y-3 rounded-xl border border-brand/40 bg-brand/5 p-3">
          <p className="text-sm font-semibold text-foreground">{tx("nuevoAlumno")}</p>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={tx("nombreYApellidos")}
            maxLength={120}
            autoFocus
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
          <select
            value={newLevel}
            onChange={(e) => setNewLevel(e.target.value)}
            aria-label={tx("nivelDelAlumno")}
            className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground"
          >
            <option value="">{tx("nivelOpcional")}</option>
            {NEW_STUDENT_LEVELS.map((l) => (
              <option key={l.id} value={l.id}>
                {term(l.label)} · {term(l.desc)}
              </option>
            ))}
          </select>
          {newError && (
            <p className="text-xs font-medium text-destructive">{newError}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void createStudent()}
              disabled={savingNew}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
            >
              {savingNew && <Loader2 className="size-4 animate-spin" />}
              {tx("darDeAltaY")}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setNewError(null);
              }}
              className="h-9 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              {tx("cancelar")}
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {tx("quedaGuardadoEnTus")}
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-foreground/25 px-3 text-sm font-semibold text-foreground transition-colors hover:border-brand hover:text-brand"
        >
          <Plus className="size-4" />
          {tx("nuevoAlumno")}
        </button>
      )}

      {/* Tab selector */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-xl border border-border">
        <button
          type="button"
          onClick={() => setTab("individual")}
          className={cn(
            "order-last flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg text-xs font-medium transition-colors",
            tab === "individual"
              ? "bg-background text-foreground border border-border"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="size-3.5" />
          {tx("claseSueltaAlumnos")}
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
          {tx("porGrupo")}
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
                {tx("noTienesGruposCreados")}
              </p>
              <Link
                href="/groups"
                className="mt-2 inline-block text-xs text-brand hover:underline"
              >
                {tx("crearUnGrupo")}
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
                        {g.memberCount === 1 ? tx("studentOne") : tx("studentMany")}
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
              {tx("v1AlumnoV2Seleccionado", { v1: state.studentIds.length, v2: state.studentIds.length !== 1 ? "s" : "", v3: state.studentIds.length !== 1 ? "s" : "" })}</p>
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
              placeholder={tx("buscarAlumnos")}
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
            {students.length === 0 ? (
              <p className="col-span-full py-6 text-center text-xs text-muted-foreground">
                {tx("aunNoTienesAlumnos2")}
              </p>
            ) : (
              filtered.length === 0 && (
                <p className="text-xs text-muted-foreground col-span-full text-center py-6">
                  {tx("sinResultadosParaV1", { v1: search })}</p>
              )
            )}
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {tx("estePasoEsOpcional")}
      </p>
    </div>
  );
}
