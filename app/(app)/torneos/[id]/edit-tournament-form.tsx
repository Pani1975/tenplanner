"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, X } from "lucide-react";
import { madridParts, madridToIso } from "@/lib/tournaments/schedule";
import { useApiError } from "../use-api-error";

/** Día "AAAA-MM-DD" y hora "HH:MM" de España de una fecha ISO. */
function splitLocal(iso: string | null) {
  if (!iso) return { date: "", time: "23:59" };
  // En hora de España, sea cual sea la zona del navegador.
  return madridParts(new Date(iso));
}

/**
 * Editar los datos básicos: nombre, descripción, fechas, plazo y plazas.
 * Lo demás (modalidad, formato) se bloquea en el servidor cuando ya hay
 * inscritos o cuadro.
 */
export function EditTournamentForm({
  tournament: t,
  onDone,
  onCancel,
}: {
  tournament: {
    id: string;
    name: string;
    description: string | null;
    startDate: string;
    endDate: string | null;
    registrationDeadline: string | null;
    maxEntries: number | null;
  };
  onDone: () => void;
  onCancel: () => void;
}) {
  const tr = useTranslations("tournaments");
  const apiError = useApiError();
  const dl = splitLocal(t.registrationDeadline);
  const [f, setF] = useState({
    name: t.name,
    description: t.description ?? "",
    startDate: t.startDate,
    endDate: t.endDate ?? "",
    deadlineDate: dl.date,
    deadlineTime: dl.time,
    maxEntries: t.maxEntries ? String(t.maxEntries) : "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  const max = f.maxEntries ? Number(f.maxEntries) : null;
  const errors: string[] = [];
  if (f.name.trim().length < 3) errors.push(tr("wizard.errName"));
  if (!f.startDate) errors.push(tr("wizard.errStart"));
  if (f.endDate && f.endDate < f.startDate) errors.push(tr("wizard.errEnd"));
  if (f.deadlineDate && f.deadlineDate > f.startDate) {
    errors.push(tr("wizard.errDeadline"));
  }
  if (max !== null && (!Number.isInteger(max) || max < 2 || max > 256)) {
    errors.push(tr("wizard.errMax"));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (errors.length) return;
    setSaving(true);
    const res = await fetch(`/api/tournaments/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.name.trim(),
        description: f.description.trim() || null,
        startDate: f.startDate,
        endDate: f.endDate || null,
        registrationDeadline: f.deadlineDate
          ? madridToIso(f.deadlineDate, f.deadlineTime || "23:59")
          : null,
        maxEntries: max,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(await apiError(res));
      return;
    }
    const { data } = await res.json();
    toast.success(
      data?.promoted?.length
        ? tr("manager.promoted", { count: data.promoted.length })
        : tr("edit.saved")
    );
    onDone();
  }

  const label = "text-xs font-bold uppercase text-foreground/60";
  return (
    <form onSubmit={save} className="tp-card space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <h2 className="tp-title text-xl">{tr("edit.title")}</h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label={tr("external.close")}
          className="inline-flex size-11 items-center justify-center rounded-full hover:bg-foreground/5"
        >
          <X className="size-5" />
        </button>
      </div>
      <label className="block space-y-1.5">
        <span className={label}>{tr("wizard.name")}</span>
        <input
          value={f.name}
          onChange={(e) => set("name", e.target.value)}
          maxLength={160}
          className="tp-field h-11 w-full px-4 text-base"
        />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={label}>{tr("wizard.startDate")}</span>
          <input
            type="date"
            value={f.startDate}
            onChange={(e) => set("startDate", e.target.value)}
            className="tp-field h-11 w-full px-4 text-base"
          />
        </label>
        <label className="block space-y-1.5">
          <span className={label}>{tr("wizard.endDate")}</span>
          <input
            type="date"
            value={f.endDate}
            min={f.startDate || undefined}
            onChange={(e) => set("endDate", e.target.value)}
            className="tp-field h-11 w-full px-4 text-base"
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1.5">
          <span className={label}>{tr("wizard.deadline")}</span>
          <div className="flex gap-2">
            <input
              type="date"
              value={f.deadlineDate}
              max={f.startDate || undefined}
              onChange={(e) => set("deadlineDate", e.target.value)}
              className="tp-field h-11 min-w-0 flex-1 px-3 text-base"
            />
            <input
              type="time"
              value={f.deadlineTime}
              onChange={(e) => set("deadlineTime", e.target.value)}
              aria-label={tr("wizard.deadlineTime")}
              className="tp-field h-11 w-28 px-3 text-base"
            />
          </div>
        </label>
        <label className="block space-y-1.5">
          <span className={label}>{tr("wizard.maxEntries")}</span>
          <input
            type="number"
            inputMode="numeric"
            min={2}
            max={256}
            value={f.maxEntries}
            placeholder={tr("wizard.noLimit")}
            onChange={(e) => set("maxEntries", e.target.value)}
            className="tp-field h-11 w-full px-4 text-base"
          />
        </label>
      </div>
      <label className="block space-y-1.5">
        <span className={label}>{tr("wizard.description")}</span>
        <textarea
          value={f.description}
          onChange={(e) => set("description", e.target.value)}
          rows={3}
          maxLength={2000}
          className="tp-field w-full px-4 py-3 text-base"
        />
      </label>
      {errors.length > 0 && (
        <ul className="space-y-1 text-sm font-semibold text-red-600">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
      <p className="text-xs text-foreground/65">{tr("edit.note")}</p>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="h-11 rounded-full px-5 text-sm font-semibold"
        >
          {tr("external.cancel")}
        </button>
        <button
          type="submit"
          disabled={errors.length > 0 || saving}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-6 text-sm font-bold text-black disabled:opacity-40"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {tr("edit.save")}
        </button>
      </div>
    </form>
  );
}
