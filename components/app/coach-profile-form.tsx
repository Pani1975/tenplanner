"use client";

import { useState } from "react";
import { Check, Loader2, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  DAY_BLOCKS,
  MAX_EXPERIENCE_ENTRIES,
  WEEKDAYS,
  coachProfileSchema,
  isAllSelected,
  isDayFull,
  toggleAll,
  toggleBlock,
  toggleDay,
  type Availability,
  type CoachProfileData,
  type ExperienceEntry,
} from "@/lib/coach-profile";

type ExperienceRow = {
  startYear: string;
  endYear: string;
  /** "Hasta la actualidad" */
  current: boolean;
  company: string;
  role: string;
};

export type CoachProfileInitial = {
  fullName?: string;
  email?: string;
  phone?: string | null;
  academicTraining?: string | null;
  tennisTraining?: string | null;
  availability?: Availability | null;
  startedTeachingYear?: number | null;
  experience?: ExperienceEntry[];
};

export type CoachProfileSubmitResult =
  | { ok: true }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

function rowFromEntry(entry: ExperienceEntry): ExperienceRow {
  return {
    startYear: String(entry.startYear),
    endYear: entry.endYear === null ? "" : String(entry.endYear),
    current: entry.endYear === null,
    company: entry.company ?? "",
    role: entry.role ?? "",
  };
}

function emptyRow(): ExperienceRow {
  return { startYear: "", endYear: "", current: false, company: "", role: "" };
}

const OPTIONAL = (
  <span className="font-normal text-foreground/50"> (opcional)</span>
);

/**
 * Formulario de la ficha de monitor. Lo usa el gestor (crear y editar) y el
 * propio monitor desde el enlace público. Valida con el mismo esquema que el
 * servidor antes de enviar.
 */
export function CoachProfileForm({
  initial,
  lockEmail = false,
  submitLabel,
  consentLabel,
  onSubmit,
  onCancel,
}: {
  initial?: CoachProfileInitial;
  /** El email identifica al monitor: en el enlace público no se cambia. */
  lockEmail?: boolean;
  submitLabel: string;
  /** Si se indica, hay que marcar este consentimiento para enviar. */
  consentLabel?: string;
  onSubmit: (
    data: CoachProfileData,
    consent: boolean
  ) => Promise<CoachProfileSubmitResult>;
  onCancel?: () => void;
}) {
  const [fullName, setFullName] = useState(initial?.fullName ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [academic, setAcademic] = useState(initial?.academicTraining ?? "");
  const [tennis, setTennis] = useState(initial?.tennisTraining ?? "");
  const [availability, setAvailability] = useState<Availability>(
    initial?.availability ?? {}
  );
  const [startedYear, setStartedYear] = useState(
    initial?.startedTeachingYear ? String(initial.startedTeachingYear) : ""
  );
  const [experience, setExperience] = useState<ExperienceRow[]>(
    (initial?.experience ?? []).map(rowFromEntry)
  );
  const [consent, setConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const err = (key: string) =>
    fieldErrors[key] ? (
      <p className="text-xs text-destructive">{fieldErrors[key]}</p>
    ) : null;

  function updateRow(index: number, patch: Partial<ExperienceRow>) {
    setExperience((rows) =>
      rows.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const toNumber = (value: string) =>
      value.trim() === "" ? undefined : Number(value);

    // El "hasta la actualidad" lo comprobamos aquí para dar un mensaje claro.
    const rowErrors: Record<string, string> = {};
    experience.forEach((row, i) => {
      if (!row.current && row.endYear.trim() === "") {
        rowErrors[`experience.${i}.endYear`] =
          "Indica el año de finalización o marca «Hasta la actualidad»";
      }
    });
    if (Object.keys(rowErrors).length > 0) {
      setFieldErrors(rowErrors);
      setError("Revisa la experiencia como monitor.");
      return;
    }

    const parsed = coachProfileSchema.safeParse({
      fullName,
      email,
      phone,
      academicTraining: academic,
      tennisTraining: tennis,
      availability,
      startedTeachingYear: toNumber(startedYear) ?? null,
      experience: experience.map((row) => ({
        startYear: toNumber(row.startYear),
        endYear: row.current ? null : toNumber(row.endYear),
        company: row.company,
        role: row.role,
      })),
    });
    if (!parsed.success) {
      setFieldErrors(
        Object.fromEntries(
          parsed.error.issues
            .reverse()
            .map((issue) => [issue.path.join("."), issue.message])
        )
      );
      setError("Revisa los campos marcados.");
      return;
    }
    if (consentLabel && !consent) {
      setFieldErrors({ consent: "Debes aceptar para enviar la ficha." });
      setError("Falta aceptar el tratamiento de tus datos.");
      return;
    }

    setFieldErrors({});
    setSaving(true);
    try {
      const result = await onSubmit(parsed.data, consent);
      if (!result.ok) {
        setError(result.error);
        setFieldErrors(result.fieldErrors ?? {});
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Datos de contacto (obligatorios) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="cp-name">Nombre y apellidos</Label>
          <Input
            id="cp-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            autoComplete="name"
            aria-invalid={!!fieldErrors.fullName}
          />
          {err("fullName")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp-email">Email</Label>
          <Input
            id="cp-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            readOnly={lockEmail}
            autoComplete="email"
            aria-invalid={!!fieldErrors.email}
            className={lockEmail ? "bg-muted text-muted-foreground" : undefined}
          />
          {lockEmail && (
            <p className="text-xs text-foreground/50">
              Es el correo al que se envió el enlace. Si no es correcto, avisa
              al club.
            </p>
          )}
          {err("email")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp-phone">Teléfono</Label>
          <Input
            id="cp-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            aria-invalid={!!fieldErrors.phone}
          />
          {err("phone")}
        </div>
      </div>

      {/* Formación */}
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="cp-academic">Formación académica{OPTIONAL}</Label>
          <Textarea
            id="cp-academic"
            value={academic}
            onChange={(e) => setAcademic(e.target.value)}
            placeholder="Estudios, titulaciones..."
            rows={3}
            aria-invalid={!!fieldErrors.academicTraining}
          />
          {err("academicTraining")}
        </div>
        <div className="space-y-2">
          <Label htmlFor="cp-tennis">Formación en tenis{OPTIONAL}</Label>
          <Textarea
            id="cp-tennis"
            value={tennis}
            onChange={(e) => setTennis(e.target.value)}
            placeholder="Cursos de monitor, titulaciones federativas..."
            rows={3}
            aria-invalid={!!fieldErrors.tennisTraining}
          />
          {err("tennisTraining")}
        </div>
      </div>

      {/* Disponibilidad horaria */}
      <fieldset className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <legend className="text-sm font-medium text-foreground">
            Disponibilidad horaria{OPTIONAL}
          </legend>
          <button
            type="button"
            onClick={() => setAvailability(toggleAll(availability))}
            className="rounded-full border border-border px-3 py-1 text-xs font-bold text-foreground transition-colors hover:bg-muted"
          >
            {isAllSelected(availability) ? "Quitar todos" : "Todos"}
          </button>
        </div>
        <div className="grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))_3.5rem] items-center gap-1.5 sm:gap-2">
          <span />
          {DAY_BLOCKS.map((block) => (
            <span
              key={block.id}
              className="text-center text-[11px] font-black uppercase text-foreground/50"
            >
              {block.label}
            </span>
          ))}
          <span />
          {WEEKDAYS.map((day) => (
            <DayRow
              key={day.id}
              label={day.label}
              blocks={availability[day.id] ?? []}
              full={isDayFull(availability, day.id)}
              onToggleBlock={(block) =>
                setAvailability(toggleBlock(availability, day.id, block))
              }
              onToggleDay={() =>
                setAvailability(toggleDay(availability, day.id))
              }
            />
          ))}
        </div>
        {err("availability")}
      </fieldset>

      {/* Experiencia */}
      <div className="space-y-4">
        <div className="max-w-xs space-y-2">
          <Label htmlFor="cp-started">
            Año en el que empezaste a dar clases{OPTIONAL}
          </Label>
          <Input
            id="cp-started"
            inputMode="numeric"
            placeholder="2015"
            value={startedYear}
            onChange={(e) => setStartedYear(e.target.value)}
            aria-invalid={!!fieldErrors.startedTeachingYear}
          />
          {err("startedTeachingYear")}
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-foreground">
            Experiencia como monitor{OPTIONAL}
          </p>
          {experience.map((row, i) => (
            <div
              key={i}
              className="space-y-3 rounded-2xl border border-border p-3"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor={`cp-exp-${i}-start`}>Año de comienzo</Label>
                  <Input
                    id={`cp-exp-${i}-start`}
                    inputMode="numeric"
                    placeholder="2018"
                    value={row.startYear}
                    onChange={(e) =>
                      updateRow(i, { startYear: e.target.value })
                    }
                    aria-invalid={!!fieldErrors[`experience.${i}.startYear`]}
                  />
                  {err(`experience.${i}.startYear`)}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`cp-exp-${i}-end`}>Año de finalización</Label>
                  <Input
                    id={`cp-exp-${i}-end`}
                    inputMode="numeric"
                    placeholder={row.current ? "Actualidad" : "2022"}
                    value={row.current ? "" : row.endYear}
                    disabled={row.current}
                    onChange={(e) => updateRow(i, { endYear: e.target.value })}
                    aria-invalid={!!fieldErrors[`experience.${i}.endYear`]}
                  />
                  <label className="flex items-center gap-2 text-xs font-semibold text-foreground/70">
                    <input
                      type="checkbox"
                      checked={row.current}
                      onChange={(e) =>
                        updateRow(i, {
                          current: e.target.checked,
                          endYear: e.target.checked ? "" : row.endYear,
                        })
                      }
                      className="size-4 accent-[#1a6db5]"
                    />
                    Hasta la actualidad
                  </label>
                  {err(`experience.${i}.endYear`)}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`cp-exp-${i}-company`}>
                    Empresa{OPTIONAL}
                  </Label>
                  <Input
                    id={`cp-exp-${i}-company`}
                    value={row.company}
                    onChange={(e) => updateRow(i, { company: e.target.value })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`cp-exp-${i}-role`}>Rol{OPTIONAL}</Label>
                  <Input
                    id={`cp-exp-${i}-role`}
                    value={row.role}
                    onChange={(e) => updateRow(i, { role: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setExperience((rows) => rows.filter((_, j) => j !== i))
                }
                className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground/60 transition-colors hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
                Quitar esta experiencia
              </button>
            </div>
          ))}
          {experience.length < MAX_EXPERIENCE_ENTRIES && (
            <button
              type="button"
              onClick={() => setExperience((rows) => [...rows, emptyRow()])}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-bold text-foreground transition-colors hover:bg-muted"
            >
              <Plus className="size-4" />
              Añadir experiencia
            </button>
          )}
        </div>
      </div>

      {consentLabel && (
        <div className="space-y-1">
          <label className="flex items-start gap-2.5 text-sm leading-5 text-foreground/80">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[#1a6db5]"
            />
            <span>{consentLabel}</span>
          </label>
          {err("consent")}
        </div>
      )}

      {error && (
        <p className="rounded-2xl border border-destructive/25 bg-destructive/10 px-4 py-2.5 text-sm text-destructive">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-6 text-sm font-black text-brand-foreground disabled:opacity-60"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="h-11 rounded-full border border-border px-5 text-sm font-bold text-foreground hover:bg-muted"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}

function DayRow({
  label,
  blocks,
  full,
  onToggleBlock,
  onToggleDay,
}: {
  label: string;
  blocks: string[];
  full: boolean;
  onToggleBlock: (block: (typeof DAY_BLOCKS)[number]["id"]) => void;
  onToggleDay: () => void;
}) {
  return (
    <>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      {DAY_BLOCKS.map((block) => {
        const checked = blocks.includes(block.id);
        return (
          <button
            key={block.id}
            type="button"
            role="checkbox"
            aria-checked={checked}
            aria-label={`${label}, ${block.label.toLowerCase()}`}
            onClick={() => onToggleBlock(block.id)}
            className={cn(
              "flex h-9 items-center justify-center rounded-lg border transition-colors",
              checked
                ? "border-brand bg-brand text-brand-foreground"
                : "border-border text-transparent hover:bg-muted"
            )}
          >
            <Check className="size-4" />
          </button>
        );
      })}
      <button
        type="button"
        onClick={onToggleDay}
        className="h-9 rounded-lg text-[11px] font-black uppercase text-foreground/55 transition-colors hover:bg-muted hover:text-foreground"
      >
        {full ? "Quitar" : "Todos"}
      </button>
    </>
  );
}
