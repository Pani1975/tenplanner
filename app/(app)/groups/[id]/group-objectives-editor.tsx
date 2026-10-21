"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Target } from "lucide-react";
import { ObjectivesPicker } from "@/components/objectives/objectives-picker";
import { appendObjectiveLines, objectiveLines } from "@/lib/objectives-text";
import type { BallId } from "@/lib/objectives-taxonomy";

/**
 * Objetivos de trabajo del grupo: se cargan del catálogo de Objetivos (el del
 * club o el propio) o se escriben a mano, uno por línea.
 */
export function GroupObjectivesEditor({
  groupId,
  initialObjetivos,
  defaultBall,
  canEdit,
}: {
  groupId: string;
  initialObjetivos: string | null;
  defaultBall: BallId | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initialObjetivos ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = objectiveLines(initialObjetivos);

  async function persist(next: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objetivos: next.trim() || null }),
      });
      if (!res.ok) {
        setError("No se pudieron guardar los objetivos.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  function startEditing() {
    setValue(initialObjetivos ?? "");
    setError(null);
    setEditing(true);
  }

  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Target className="size-4 text-brand" />
          <div>
            <h2 className="text-lg font-black text-foreground">
              Objetivos del grupo
            </h2>
            <p className="text-sm text-muted-foreground">
              Lo que se trabaja con este grupo. Cárgalos del catálogo de
              objetivos o escríbelos a mano.
            </p>
          </div>
        </div>
        {canEdit && !editing && (
          <div className="flex flex-wrap items-center gap-2">
            <ObjectivesPicker
              currentText={initialObjetivos}
              defaultBall={defaultBall}
              onAdd={(titles) =>
                void persist(
                  appendObjectiveLines(initialObjetivos, titles).slice(0, 4000)
                )
              }
            />
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-bold text-foreground/70 transition-colors hover:bg-muted"
            >
              <Pencil className="size-3.5" />
              {lines.length ? "Editar" : "Escribir"}
            </button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="mt-4 space-y-3">
          <div className="flex justify-end">
            <ObjectivesPicker
              currentText={value}
              defaultBall={defaultBall}
              onAdd={(titles) =>
                setValue((prev) =>
                  appendObjectiveLines(prev, titles).slice(0, 4000)
                )
              }
            />
          </div>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={6}
            maxLength={4000}
            autoFocus
            placeholder={
              "Un objetivo por línea.\nEj: Mantener 10 golpes de peloteo cruzado"
            }
            className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/40"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-full border border-border px-4 py-2 text-sm font-bold text-foreground/70 transition-colors hover:bg-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={async () => {
                if (await persist(value)) setEditing(false);
              }}
              className="inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-4 py-2 text-sm font-black text-[#050505] transition-colors hover:bg-[#c8ef2f] disabled:opacity-50"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              Guardar
            </button>
          </div>
        </div>
      ) : lines.length ? (
        <ul className="mt-4 space-y-1.5">
          {lines.map((line, i) => (
            <li
              key={`${i}-${line}`}
              className="flex gap-2 text-sm leading-relaxed text-foreground"
            >
              <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" />
              {line}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-muted-foreground">
          {canEdit
            ? "Aún no hay objetivos para este grupo."
            : "Este grupo aún no tiene objetivos."}
        </p>
      )}

      {saving && !editing && (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Guardando…
        </p>
      )}
      {error && (
        <p className="mt-3 text-xs font-semibold text-destructive">{error}</p>
      )}
    </section>
  );
}
