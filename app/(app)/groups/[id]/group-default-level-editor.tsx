"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Gauge, Loader2 } from "lucide-react";

type LevelOption = { code: string; labelEs: string };

/**
 * Nivel por defecto del grupo: lo usa "Monta la clase" cuando los alumnos
 * que vienen no tienen nivel en su ficha. Se guarda al elegirlo.
 */
export function GroupDefaultLevelEditor({
  groupId,
  initialLevel,
  levels,
  canEdit,
}: {
  groupId: string;
  initialLevel: string | null;
  levels: LevelOption[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initialLevel ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentLabel =
    levels.find((l) => l.code === (initialLevel ?? ""))?.labelEs ?? null;

  async function save(next: string) {
    const previous = value;
    setValue(next);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ defaultLevel: next || null }),
      });
      if (!res.ok) {
        setValue(previous);
        setError("No se pudo guardar el nivel.");
        return;
      }
      router.refresh();
    } catch {
      setValue(previous);
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#050505]/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-white/[0.04]">
      <Gauge className="size-4 shrink-0 text-brand" />
      <label
        htmlFor={`default-level-${groupId}`}
        className="text-sm font-semibold text-foreground"
      >
        Nivel por defecto
      </label>
      {canEdit ? (
        <select
          id={`default-level-${groupId}`}
          value={value}
          disabled={saving}
          onChange={(e) => save(e.target.value)}
          className="min-h-9 rounded-md border border-foreground/15 bg-background px-2 text-sm text-foreground"
        >
          <option value="">Sin definir</option>
          {levels.map((l) => (
            <option key={l.code} value={l.code}>
              {l.labelEs}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-sm text-muted-foreground">
          {currentLabel ?? "Sin definir"}
        </span>
      )}
      {saving && (
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
      )}
      <p className="w-full text-xs text-muted-foreground">
        Se usa cuando los alumnos que vienen no tienen nivel en su ficha.
      </p>
      {error && <p className="w-full text-xs text-destructive">{error}</p>}
    </div>
  );
}
