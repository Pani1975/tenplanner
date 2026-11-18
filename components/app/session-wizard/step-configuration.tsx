"use client";

import {
  Calendar,
  Clock,
  MapPin,
  Repeat,
  Tag,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StepBasics } from "./step-basics";
import { StepObjective } from "./step-objective";
import { StepStudents } from "./step-students";
import type { WizardState } from "./types";
import {
  computeSessionDates,
  defaultCourseEnd,
  MAX_RECURRING_SESSIONS,
  sessionCode,
  toDateInput,
} from "./recurrence";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";

interface StepConfigurationProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  errors: Partial<Record<keyof WizardState, string>>;
  places: { id: string; name: string }[];
  monitorName?: string;
  /** Monitores del club: si hay, se elige quién imparte la sesión. */
  coaches?: { id: string; name: string }[];
  hideRecurrence?: boolean;
}

function formatScheduledAt(scheduledAt: string, loc: string = "es-ES"): string {
  try {
    const d = new Date(scheduledAt);
    if (isNaN(d.getTime())) return "Sin fecha";
    return d.toLocaleDateString(loc, {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Sin fecha";
  }
}

function SessionPreview({ state }: { state: WizardState }) {
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_sessionwizard_stepconfiguration");
  const hasTitle = !!state.title.trim();

  return (
    <div className="sticky top-6">
      <p className="mb-3 pl-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        {tx("vistaPrevia")}
      </p>

      <div className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="space-y-4 p-5">
          <p
            className={cn(
              "font-heading text-xl font-semibold leading-snug",
              hasTitle ? "text-foreground" : "text-muted-foreground/30 italic"
            )}
          >
            {hasTitle ? state.title : tx("tituloDeLaSesion")}
          </p>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Calendar className="size-3.5 shrink-0 text-brand" />
              <span className="text-xs text-foreground/70">
                {formatScheduledAt(state.scheduledAt, intlLocale)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 shrink-0 text-brand" />
              <span className="text-xs text-foreground/70">
                {tx("v1Min", { v1: state.durationMinutes })}</span>
            </div>
            {state.location && (
              <div className="flex items-center gap-2">
                <MapPin className="size-3.5 shrink-0 text-brand" />
                <span className="text-xs text-foreground/70">
                  {state.location}
                </span>
              </div>
            )}
          </div>

          {(state.objective ||
            state.material ||
            state.observations ||
            state.tags.length > 0 ||
            state.studentIds.length > 0) && (
            <div className="border-t border-border/40" />
          )}

          {state.objective && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {tx("objetivo")}
              </p>
              <p className="line-clamp-3 text-xs leading-relaxed text-foreground/65">
                {state.objective}
              </p>
            </div>
          )}

          {state.material && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {tx("material")}
              </p>
              <p className="line-clamp-2 text-xs leading-relaxed text-foreground/65">
                {state.material}
              </p>
            </div>
          )}

          {state.observations && (
            <div>
              <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {tx("observaciones")}
              </p>
              <p className="line-clamp-2 text-xs leading-relaxed text-foreground/65">
                {state.observations}
              </p>
            </div>
          )}

          {state.tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {state.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex h-5 items-center gap-1 rounded-full bg-brand/10 px-2 text-[10px] font-semibold text-brand"
                >
                  <Tag className="size-2.5" />
                  {tag}
                </span>
              ))}
            </div>
          )}

          {state.studentIds.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Users className="size-3.5 text-brand" />
              <span>
                {tx("v1AlumnoV2", { v1: state.studentIds.length, v2: state.studentIds.length !== 1 ? "s" : "" })}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function StepConfiguration({
  state,
  update,
  errors,
  places = [],
  monitorName,
  coaches = [],
  hideRecurrence = false,
}: StepConfigurationProps) {
  const tx = useTranslations("ui.s_sessionwizard_stepconfiguration");
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_252px]">
      <div className="flex min-w-0 flex-col gap-6">
        {/* Primero: para quién es (grupo o clase suelta); de ahí sale el nombre */}
        <section className="rounded-2xl border border-border bg-card p-4">
          <div className="mb-3">
            <p className="text-sm font-semibold text-foreground">
              {tx("paraQuienEsLa")}
            </p>
            <p className="text-xs text-muted-foreground">
              {tx("eligeUnGrupoO")}
            </p>
          </div>
          <StepStudents state={state} update={update} />
        </section>

        <StepBasics
          state={state}
          update={update}
          errors={errors}
          allowCodeTitle={!hideRecurrence}
        />

        {/* Una o dos pistas: se fija al empezar */}
        <div className="space-y-1.5">
          <p className="block text-sm font-semibold text-foreground">
            {tx("pistas")}
          </p>
          <div className="grid max-w-md grid-cols-2 gap-2">
            {(
              [
                { value: 1, title: tx("unaPista") },
                { value: 2, title: tx("dosPistas") },
              ] as const
            ).map(({ value, title }) => (
              <button
                key={value}
                type="button"
                aria-pressed={(state.courts === 2 ? 2 : 1) === value}
                onClick={() => update({ courts: value })}
                className={cn(
                  "rounded-xl border px-4 py-2.5 text-sm font-semibold transition-colors",
                  (state.courts === 2 ? 2 : 1) === value
                    ? "border-brand bg-brand/10 text-foreground"
                    : "border-border text-muted-foreground hover:border-brand/50"
                )}
              >
                {title}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="placeId"
            className="block text-sm font-semibold text-foreground"
          >
            {state.courts === 2 ? tx("lugarDeLaPista") : "Lugar"}{" "}
            <span className="font-normal text-muted-foreground">
              {tx("opcional")}
            </span>
          </label>
          {places.length === 0 ? (
            <p className="text-xs italic text-muted-foreground">
              {tx("aunNoTienesLugares")}{" "}
              <a
                href="/places"
                className="font-semibold text-brand hover:underline"
              >
                {tx("crearLugar")}
              </a>
            </p>
          ) : (
            <select
              id="placeId"
              value={state.placeId ?? ""}
              onChange={(e) =>
                update({ placeId: e.target.value ? e.target.value : null })
              }
              className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50"
            >
              <option value="">{tx("sinLugarAsignado")}</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {state.courts === 2 && places.length > 0 && (
          <div className="space-y-1.5">
            <label
              htmlFor="secondPlaceId"
              className="block text-sm font-semibold text-foreground"
            >
              {tx("courtPlace2")}{" "}
              <span className="font-normal text-muted-foreground">
                {tx("opcional")}
              </span>
            </label>
            <select
              id="secondPlaceId"
              value={state.secondPlaceId ?? ""}
              onChange={(e) =>
                update({ secondPlaceId: e.target.value ? e.target.value : null })
              }
              className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50"
            >
              <option value="">{tx("sinLugarAsignado")}</option>
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {coaches.length > 0 ? (
          <div className="space-y-1.5">
            <label
              htmlFor="coachId"
              className="block text-sm font-semibold text-foreground"
            >
              {tx("monitorQueLaImparte")}
            </label>
            <select
              id="coachId"
              value={state.coachId ?? ""}
              onChange={(e) => update({ coachId: e.target.value || null })}
              className="h-11 w-full rounded-xl border border-border bg-background px-4 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50"
            >
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          monitorName && (
            <div className="space-y-1.5">
              <label className="block text-sm font-semibold text-foreground">
                {tx("entrenador")}
              </label>
              <div className="flex h-11 cursor-not-allowed items-center rounded-xl border border-border bg-muted/40 px-4 text-sm text-foreground/80">
                {monitorName}
              </div>
            </div>
          )
        )}

        <div className="border-t border-border/40" />

        <StepObjective state={state} update={update} errors={errors} />

        {!hideRecurrence && <RecurrenceBlock state={state} update={update} />}
      </div>

      <div className="hidden lg:block">
        <SessionPreview state={state} />
      </div>
    </div>
  );
}

function formatShort(date: Date, withWeekday = true, loc: string = "es-ES") {
  return new Intl.DateTimeFormat(loc, {
    ...(withWeekday ? { weekday: "short" as const } : {}),
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

const WEEKDAY_LABELS = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAY_TO_JSDAY = [1, 2, 3, 4, 5, 6, 0];

function RecurrenceBlock({
  state,
  update,
}: {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
}) {
  const term = useTerm();
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_sessionwizard_stepconfiguration");
  const r = state.recurrence;
  const scheduled = new Date(state.scheduledAt);
  const baseWeekday = isNaN(scheduled.getTime()) ? null : scheduled.getDay();
  const mode = r.mode ?? "weeks";
  const until =
    r.until ||
    defaultCourseEnd(isNaN(scheduled.getTime()) ? new Date() : scheduled);
  const preview = r.enabled
    ? computeSessionDates(scheduled, { ...r, mode, until })
    : { dates: [], truncated: false };

  function toggleEnabled(next: boolean) {
    update({
      recurrence: {
        ...r,
        mode,
        until,
        enabled: next,
        weekdays:
          r.weekdays.length === 0 && baseWeekday !== null
            ? [baseWeekday]
            : r.weekdays,
      },
    });
  }

  function toggleWeekday(jsDay: number) {
    const has = r.weekdays.includes(jsDay);
    update({
      recurrence: {
        ...r,
        weekdays: has
          ? r.weekdays.filter((d) => d !== jsDay)
          : [...r.weekdays, jsDay],
      },
    });
  }

  return (
    <div className="rounded-2xl border border-border bg-card">
      <button
        type="button"
        onClick={() => toggleEnabled(!r.enabled)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
      >
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
          <Repeat className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {tx("repetirSesion")}
          </p>
          <p className="text-xs text-muted-foreground">
            {r.enabled
              ? `${preview.dates.length} sesiones${mode === "until" ? ` hasta el ${formatShort(new Date(until + "T12:00:00"), false, intlLocale)}` : ` en ${r.weeks} semanas`}`
              : tx("creaEstaSesionCada")}
          </p>
        </div>
        <span
          className={cn(
            "inline-flex h-6 w-11 items-center rounded-full border transition-colors",
            r.enabled ? "border-brand bg-brand" : "border-border bg-muted"
          )}
        >
          <span
            className={cn(
              "size-5 rounded-full bg-background transition-transform",
              r.enabled ? "translate-x-5" : "translate-x-0.5"
            )}
          />
        </span>
      </button>

      {r.enabled && (
        <div className="space-y-4 border-t border-border px-4 py-4">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tx("diasDeLaSemana")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_LABELS.map((label, i) => {
                const jsDay = WEEKDAY_TO_JSDAY[i];
                const active = r.weekdays.includes(jsDay);
                return (
                  <button
                    key={jsDay}
                    type="button"
                    onClick={() => toggleWeekday(jsDay)}
                    className={cn(
                      "size-9 rounded-lg border text-sm font-semibold transition-colors",
                      active
                        ? "border-brand bg-brand text-brand-foreground"
                        : "border-border text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
            {r.weekdays.length === 0 && baseWeekday !== null && (
              <p className="mt-2 text-[11px] italic text-muted-foreground">
                {tx("siNoEligesDias")}
              </p>
            )}
          </div>

          <div className="space-y-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {tx("hastaCuando")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { id: "until", label: tx("hastaUnaFecha") },
                  { id: "weeks", label: tx("numeroDeSemanas") },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    update({
                      recurrence: {
                        ...r,
                        mode: option.id,
                        until:
                          r.until ||
                          defaultCourseEnd(
                            isNaN(scheduled.getTime()) ? new Date() : scheduled
                          ),
                      },
                    })
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                    mode === option.id
                      ? "border-brand bg-brand text-brand-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {term(option.label)}
                </button>
              ))}
            </div>

            {mode === "until" ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  id="recurrence-until"
                  type="date"
                  value={until}
                  min={
                    isNaN(scheduled.getTime())
                      ? undefined
                      : toDateInput(scheduled)
                  }
                  onChange={(e) =>
                    update({ recurrence: { ...r, until: e.target.value } })
                  }
                  className="h-10 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50"
                />
                <span className="text-xs text-muted-foreground">
                  {tx("incluidaPEjFin")}
                </span>
              </div>
            ) : (
              <div>
                <input
                  id="recurrence-weeks"
                  type="number"
                  min={2}
                  max={52}
                  value={r.weeks}
                  onChange={(e) =>
                    update({
                      recurrence: {
                        ...r,
                        weeks: Math.min(
                          52,
                          Math.max(2, parseInt(e.target.value, 10) || 2)
                        ),
                      },
                    })
                  }
                  className="h-10 w-24 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50"
                />
                <span className="ml-2 text-xs text-muted-foreground">
                  {tx("semanasIncluidaLaPrimera")}
                </span>
              </div>
            )}
          </div>

          {preview.dates.length > 0 && (
            <div className="rounded-xl border border-brand/30 bg-brand/5 px-3 py-3">
              <p className="text-sm font-semibold text-foreground">
                {tx("seCrearanV1Sesiones", { v1: preview.dates.length })}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatShort(preview.dates[0], undefined, intlLocale)}
                {preview.dates.length > 1
                  ? ` → ${formatShort(preview.dates[preview.dates.length - 1], undefined, intlLocale)}`
                  : ""}
              </p>
              {state.useCodeTitle && (
                <p className="mt-2 break-words font-mono text-[11px] text-foreground/70">
                  {preview.dates
                    .slice(0, 3)
                    .map((d) => sessionCode(d, state.groupName ?? ""))
                    .join(", ")}
                  {preview.dates.length > 3 ? ", …" : ""}
                </p>
              )}
              {preview.truncated && (
                <p className="mt-2 text-xs font-medium text-destructive">
                  {tx("maximoV1SesionesDe", { v1: MAX_RECURRING_SESSIONS, v2: MAX_RECURRING_SESSIONS })}</p>
              )}
            </div>
          )}

          <p className="text-[12px] italic text-muted-foreground">
            {tx("seCrearanAutomaticamenteTodas")}
          </p>
        </div>
      )}
    </div>
  );
}
