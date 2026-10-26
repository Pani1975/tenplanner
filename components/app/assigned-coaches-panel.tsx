"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, UserCog } from "lucide-react";
import { cn } from "@/lib/utils";

export type CoachOption = { id: string; name: string };

/**
 * Monitores asignados a un grupo o a un alumno del club. Todos los miembros
 * del club ven quién está asignado; solo el gestor (`canEdit`) puede cambiarlo.
 */
export function AssignedCoachesPanel({
  endpoint,
  assigned,
  options,
  canEdit,
  subject,
  emptyHint,
}: {
  /** p. ej. /api/groups/<id>/coaches */
  endpoint: string;
  assigned: CoachOption[];
  /** Monitores del club que se pueden asignar (solo si canEdit). */
  options: CoachOption[];
  canEdit: boolean;
  /** "este grupo" / "este alumno" */
  subject: string;
  emptyHint?: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState<string[]>(assigned.map((c) => c.id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function startEditing() {
    setSelected(assigned.map((c) => c.id));
    setError(null);
    setEditing(true);
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ coachIds: selected }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          typeof body?.error === "string"
            ? body.error
            : "No se pudo guardar la asignación."
        );
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-foreground">
          <UserCog className="size-4 text-brand" />
          Monitores asignados
        </h2>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="rounded-full border border-border px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-muted"
          >
            {assigned.length > 0 ? "Cambiar" : "Asignar"}
          </button>
        )}
      </div>

      {!editing && (
        <>
          {assigned.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {emptyHint ?? `Todavía no hay monitores asignados a ${subject}.`}
            </p>
          ) : (
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {assigned.map((coach) => (
                <li
                  key={coach.id}
                  className="rounded-full bg-brand/10 px-3 py-1 text-sm font-semibold text-foreground"
                >
                  {coach.name}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {editing && (
        <div className="mt-3 space-y-3">
          {options.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay monitores dados de alta en el club para esto. Invítalos
              desde Gestión → Monitores.
            </p>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-2">
              {options.map((coach) => {
                const checked = selected.includes(coach.id);
                return (
                  <li key={coach.id}>
                    <button
                      type="button"
                      onClick={() => toggle(coach.id)}
                      aria-pressed={checked}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-2xl border px-3 py-2 text-left text-sm font-semibold transition-colors",
                        checked
                          ? "border-brand bg-brand/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-muted"
                      )}
                    >
                      <span
                        className={cn(
                          "flex size-5 shrink-0 items-center justify-center rounded-full border",
                          checked
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-border"
                        )}
                      >
                        {checked && <Check className="size-3" />}
                      </span>
                      <span className="min-w-0 truncate">{coach.name}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {error && <p className="text-xs text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand px-4 text-sm font-black text-brand-foreground disabled:opacity-60"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={saving}
              className="h-9 rounded-full border border-border px-4 text-sm font-bold text-foreground hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
