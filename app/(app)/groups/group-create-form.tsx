"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Users } from "lucide-react";
import { WeeklySchedulePicker } from "@/components/app/weekly-schedule-picker";

export function GroupCreateForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  // Días de clase y hora (weekday 0=domingo..6=sábado → "HH:MM"): obligatorio
  // al menos uno, para que "Asignar clase" proponga sola la próxima fecha.
  const [schedule, setSchedule] = useState<Map<number, string>>(new Map());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || schedule.size === 0) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/groups", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || undefined,
        weeklySchedule: Array.from(schedule.entries()).map(
          ([weekday, time]) => ({ weekday, time })
        ),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("No se pudo crear el grupo.");
      return;
    }
    const { data } = await res.json();
    router.push(`/groups/${data.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-[11px] font-black uppercase text-foreground/45">
          Nombre <span className="text-brand">*</span>
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Grupo Martes tarde"
          maxLength={255}
          required
          className="tp-field h-11 w-full px-4 text-sm font-medium placeholder:text-foreground/30"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-black uppercase text-foreground/45">
          Descripción{" "}
          <span className="text-foreground/25 normal-case font-normal">
            opcional
          </span>
        </label>
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Nivel, horario, pista..."
          maxLength={255}
          className="tp-field h-11 w-full px-4 text-sm font-medium placeholder:text-foreground/30"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-[11px] font-black uppercase text-foreground/45">
          Días y hora de clase <span className="text-brand">*</span>
        </label>
        <p className="text-xs text-foreground/50">
          Marca los días de la semana en que juega este grupo y a qué hora.
        </p>
        <WeeklySchedulePicker value={schedule} onChange={setSchedule} />
      </div>
      {error && (
        <p className="rounded-[20px] border border-destructive/20 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={saving || !name.trim() || schedule.size === 0}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-brand px-4 text-sm font-black text-brand-foreground shadow-sm transition-colors hover:bg-brand/90 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {saving ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Users className="size-4" />
        )}
        Crear grupo
      </button>
    </form>
  );
}
