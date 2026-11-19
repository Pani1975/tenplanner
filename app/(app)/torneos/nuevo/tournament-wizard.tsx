"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  User,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiError } from "../use-api-error";

type Option = { code: string; label: string; color: string | null };
type Place = { id: string; name: string };
type Circuit = { id: string; name: string; season: string | null };

type Form = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
  deadlineDate: string;
  deadlineTime: string;
  maxEntries: string;
  placeIds: string[];
  modality: "singles" | "doubles" | null;
  levelCode: string | null;
  format: "knockout" | "round_robin" | null;
  bestOf: 1 | 3 | 5;
  gamesPerSet: number;
  finalSet: "full" | "super_tiebreak";
  // Independiente, de un circuito existente o de uno nuevo.
  circuitMode: "independent" | "existing" | "new";
  circuitId: string;
  circuitName: string;
  circuitSeason: string;
};

const STEPS = ["basics", "modality", "level", "format"] as const;

export function TournamentWizard({
  levels,
  places,
  circuits,
}: {
  levels: Option[];
  places: Place[];
  circuits: Circuit[];
}) {
  const t = useTranslations("tournaments");
  const apiError = useApiError();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [f, setF] = useState<Form>({
    name: "",
    description: "",
    startDate: "",
    endDate: "",
    deadlineDate: "",
    deadlineTime: "23:59",
    maxEntries: "",
    placeIds: [],
    modality: null,
    levelCode: null,
    format: null,
    bestOf: 3,
    gamesPerSet: 6,
    finalSet: "super_tiebreak",
    circuitMode: "independent",
    circuitId: circuits[0]?.id ?? "",
    circuitName: "",
    circuitSeason: String(new Date().getFullYear()),
  });
  const set = <K extends keyof Form>(k: K, v: Form[K]) =>
    setF((prev) => ({ ...prev, [k]: v }));

  // Errores del paso 1 (datos básicos).
  const basicsErrors: string[] = [];
  if (f.name.trim().length < 3) basicsErrors.push(t("wizard.errName"));
  if (!f.startDate) basicsErrors.push(t("wizard.errStart"));
  if (f.endDate && f.startDate && f.endDate < f.startDate) {
    basicsErrors.push(t("wizard.errEnd"));
  }
  if (f.deadlineDate && f.startDate && f.deadlineDate > f.startDate) {
    basicsErrors.push(t("wizard.errDeadline"));
  }
  const max = f.maxEntries ? Number(f.maxEntries) : null;
  if (f.circuitMode === "new" && f.circuitName.trim().length < 2) {
    basicsErrors.push(t("wizard.errCircuit"));
  }
  if (f.circuitMode === "existing" && !f.circuitId) {
    basicsErrors.push(t("wizard.errCircuit"));
  }
  if (max !== null && (!Number.isInteger(max) || max < 2 || max > 256)) {
    basicsErrors.push(t("wizard.errMax"));
  }

  const canNext =
    step === 0
      ? basicsErrors.length === 0
      : step === 1
        ? f.modality !== null
        : step === 2
          ? true
          : f.format !== null;

  async function create() {
    setSaving(true);
    setError(null);
    const deadline = f.deadlineDate
      ? new Date(`${f.deadlineDate}T${f.deadlineTime || "23:59"}`).toISOString()
      : null;
    const res = await fetch("/api/tournaments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: f.name.trim(),
        description: f.description.trim() || null,
        startDate: f.startDate,
        endDate: f.endDate || null,
        registrationDeadline: deadline,
        maxEntries: max,
        placeIds: f.placeIds.length ? f.placeIds : null,
        circuitId: f.circuitMode === "existing" ? f.circuitId : null,
        newCircuit:
          f.circuitMode === "new"
            ? {
                name: f.circuitName.trim(),
                season: f.circuitSeason.trim() || null,
              }
            : null,
        modality: f.modality,
        levelCode: f.levelCode,
        format: f.format,
        bestOf: f.bestOf,
        gamesPerSet: f.gamesPerSet,
        finalSet: f.bestOf === 1 ? "full" : f.finalSet,
      }),
    });
    if (!res.ok) {
      setSaving(false);
      setError(await apiError(res));
      return;
    }
    const { data } = await res.json();
    router.push(`/torneos/${data.id}`);
    router.refresh();
  }

  return (
    <div className="tp-page-pad mx-auto w-full max-w-2xl space-y-5">
      <Link
        href="/torneos"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {t("wizard.back")}
      </Link>

      <header className="space-y-3">
        <h1 className="tp-title text-3xl sm:text-4xl">{t("wizard.title")}</h1>
        <ol className="grid grid-cols-4 gap-2" aria-label={t("wizard.steps")}>
          {STEPS.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                disabled={i > step}
                onClick={() => setStep(i)}
                className={cn(
                  "flex w-full flex-col items-start gap-1 rounded-xl px-3 py-2 text-left text-[11px] font-bold uppercase",
                  i === step
                    ? "bg-[#1a6db5] text-white"
                    : i < step
                      ? "bg-[var(--brand-muted)] text-foreground"
                      : "bg-foreground/5 text-foreground/45"
                )}
                aria-current={i === step ? "step" : undefined}
                aria-label={`${i + 1}. ${t(`wizard.step.${s}`)}`}
              >
                <span>{i + 1}</span>
                <span className="truncate normal-case">
                  {t(`wizard.step.${s}`)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </header>

      <section className="tp-card space-y-5 p-5 sm:p-6">
        {step === 0 && (
          <>
            <Field label={t("wizard.name")} required>
              <input
                value={f.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={t("wizard.namePlaceholder")}
                maxLength={160}
                className="tp-field h-11 w-full px-4 text-base"
                autoFocus
              />
            </Field>
            <fieldset className="space-y-2">
              <legend className="mb-1.5 text-xs font-bold uppercase text-foreground/60">
                {t("wizard.circuitType")}
              </legend>
              <div className="grid grid-cols-2 gap-2">
                {(["independent", "circuit"] as const).map((k) => {
                  const on =
                    k === "independent"
                      ? f.circuitMode === "independent"
                      : f.circuitMode !== "independent";
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={() =>
                        set(
                          "circuitMode",
                          k === "independent"
                            ? "independent"
                            : circuits.length
                              ? "existing"
                              : "new"
                        )
                      }
                      className={cn(
                        "min-h-11 rounded-xl px-3 text-sm font-semibold",
                        on
                          ? "bg-[#1a6db5] text-white"
                          : "bg-foreground/5 text-foreground"
                      )}
                    >
                      {t(`wizard.${k}`)}
                    </button>
                  );
                })}
              </div>
              {f.circuitMode !== "independent" && (
                <div className="tp-card-soft space-y-3 p-3">
                  {circuits.length > 0 && (
                    <label className="block space-y-1.5">
                      <span className="text-xs font-bold uppercase text-foreground/60">
                        {t("wizard.circuit")}
                      </span>
                      <select
                        value={f.circuitMode === "new" ? "__new" : f.circuitId}
                        onChange={(e) =>
                          e.target.value === "__new"
                            ? set("circuitMode", "new")
                            : setF((prev) => ({
                                ...prev,
                                circuitMode: "existing",
                                circuitId: e.target.value,
                              }))
                        }
                        className="tp-field h-11 w-full px-3 text-base"
                      >
                        {circuits.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.season ? `${c.name} · ${c.season}` : c.name}
                          </option>
                        ))}
                        <option value="__new">{t("wizard.newCircuit")}</option>
                      </select>
                    </label>
                  )}
                  {f.circuitMode === "new" && (
                    <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
                      <label className="block space-y-1.5">
                        <span className="text-xs font-bold uppercase text-foreground/60">
                          {t("wizard.circuitName")}
                        </span>
                        <input
                          value={f.circuitName}
                          onChange={(e) => set("circuitName", e.target.value)}
                          placeholder={t("wizard.circuitPlaceholder")}
                          maxLength={160}
                          className="tp-field h-11 w-full px-4 text-base"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-xs font-bold uppercase text-foreground/60">
                          {t("wizard.season")}
                        </span>
                        <input
                          value={f.circuitSeason}
                          onChange={(e) => set("circuitSeason", e.target.value)}
                          maxLength={20}
                          className="tp-field h-11 w-full px-4 text-base"
                        />
                      </label>
                    </div>
                  )}
                </div>
              )}
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("wizard.startDate")} required>
                <input
                  type="date"
                  value={f.startDate}
                  onChange={(e) => set("startDate", e.target.value)}
                  className="tp-field h-11 w-full px-4 text-base"
                />
              </Field>
              <Field label={t("wizard.endDate")} hint={t("wizard.optional")}>
                <input
                  type="date"
                  value={f.endDate}
                  min={f.startDate || undefined}
                  onChange={(e) => set("endDate", e.target.value)}
                  className="tp-field h-11 w-full px-4 text-base"
                />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={t("wizard.deadline")}
                hint={t("wizard.deadlineHint")}
              >
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
                    className="tp-field h-11 w-28 px-3 text-base"
                    aria-label={t("wizard.deadlineTime")}
                  />
                </div>
              </Field>
              <Field label={t("wizard.maxEntries")} hint={t("wizard.maxHint")}>
                <input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={256}
                  value={f.maxEntries}
                  onChange={(e) => set("maxEntries", e.target.value)}
                  placeholder={t("wizard.noLimit")}
                  className="tp-field h-11 w-full px-4 text-base"
                />
              </Field>
            </div>
            <Field label={t("wizard.places")} hint={t("wizard.optional")}>
              {places.length === 0 ? (
                <p className="text-sm text-foreground/60">
                  {t("wizard.noPlaces")}{" "}
                  <Link href="/places" className="font-semibold underline">
                    {t("wizard.addPlaces")}
                  </Link>
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {places.map((p) => {
                    const on = f.placeIds.includes(p.id);
                    return (
                      <button
                        key={p.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          set(
                            "placeIds",
                            on
                              ? f.placeIds.filter((x) => x !== p.id)
                              : [...f.placeIds, p.id]
                          )
                        }
                        className={cn(
                          "min-h-11 rounded-full px-4 text-sm font-semibold",
                          on
                            ? "bg-[#1a6db5] text-white"
                            : "bg-foreground/5 text-foreground"
                        )}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              )}
            </Field>
            <Field label={t("wizard.description")} hint={t("wizard.optional")}>
              <textarea
                value={f.description}
                onChange={(e) => set("description", e.target.value)}
                rows={3}
                maxLength={2000}
                placeholder={t("wizard.descriptionPlaceholder")}
                className="tp-field w-full px-4 py-3 text-base"
              />
            </Field>
            {f.name && basicsErrors.length > 0 && (
              <ul className="space-y-1 text-sm font-semibold text-red-600">
                {basicsErrors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
          </>
        )}

        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <Choice
              selected={f.modality === "singles"}
              onClick={() => set("modality", "singles")}
              icon={<User className="size-6" />}
              title={t("modality.singles")}
              text={t("wizard.singlesText")}
            />
            <Choice
              selected={f.modality === "doubles"}
              onClick={() => set("modality", "doubles")}
              icon={<Users className="size-6" />}
              title={t("modality.doubles")}
              text={t("wizard.doublesText")}
            />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <p className="text-sm text-foreground/70">
              {t("wizard.levelText")}
            </p>
            <div className="flex flex-wrap gap-2">
              <LevelChip
                selected={f.levelCode === null}
                onClick={() => set("levelCode", null)}
                label={t("wizard.anyLevel")}
              />
              {levels.map((l) => (
                <LevelChip
                  key={l.code}
                  selected={f.levelCode === l.code}
                  onClick={() => set("levelCode", l.code)}
                  label={l.label}
                  color={l.color}
                />
              ))}
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Choice
                selected={f.format === "knockout"}
                onClick={() => set("format", "knockout")}
                title={t("format.knockout")}
                text={t("wizard.knockoutText")}
              />
              <Choice
                selected={f.format === "round_robin"}
                onClick={() => set("format", "round_robin")}
                title={t("format.round_robin")}
                text={t("wizard.roundRobinText")}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label={t("wizard.bestOf")}>
                <select
                  value={f.bestOf}
                  onChange={(e) =>
                    set("bestOf", Number(e.target.value) as 1 | 3 | 5)
                  }
                  className="tp-field h-11 w-full px-3 text-base"
                >
                  <option value={1}>{t("wizard.oneSet")}</option>
                  <option value={3}>{t("wizard.bestOfN", { n: 3 })}</option>
                  <option value={5}>{t("wizard.bestOfN", { n: 5 })}</option>
                </select>
              </Field>
              <Field label={t("wizard.gamesPerSet")}>
                <select
                  value={f.gamesPerSet}
                  onChange={(e) => set("gamesPerSet", Number(e.target.value))}
                  className="tp-field h-11 w-full px-3 text-base"
                >
                  <option value={6}>{t("wizard.games", { n: 6 })}</option>
                  <option value={4}>{t("wizard.games", { n: 4 })}</option>
                </select>
              </Field>
              <Field label={t("wizard.finalSet")}>
                <select
                  value={f.bestOf === 1 ? "full" : f.finalSet}
                  disabled={f.bestOf === 1}
                  onChange={(e) =>
                    set("finalSet", e.target.value as Form["finalSet"])
                  }
                  className="tp-field h-11 w-full px-3 text-base disabled:opacity-50"
                >
                  <option value="super_tiebreak">
                    {t("wizard.superTiebreak")}
                  </option>
                  <option value="full">{t("wizard.fullSet")}</option>
                </select>
              </Field>
            </div>

            <div className="tp-card-soft space-y-1 p-4 text-sm">
              <p className="tp-title text-lg">{f.name}</p>
              <p>
                {f.circuitMode === "independent"
                  ? t("wizard.independent")
                  : t("wizard.inCircuit", {
                      name:
                        f.circuitMode === "new"
                          ? f.circuitName.trim()
                          : (circuits.find((c) => c.id === f.circuitId)?.name ??
                            ""),
                    })}
              </p>
              <p>
                {f.modality && t(`modality.${f.modality}`)}
                {" · "}
                {f.levelCode
                  ? levels.find((l) => l.code === f.levelCode)?.label
                  : t("wizard.anyLevel")}
                {f.format && ` · ${t(`format.${f.format}`)}`}
              </p>
              <p>
                {max ? t("wizard.summaryMax", { max }) : t("wizard.noLimit")}
              </p>
              <p className="text-foreground/70">{t("wizard.draftNote")}</p>
            </div>
          </div>
        )}

        {error && (
          <p role="alert" className="text-sm font-semibold text-red-600">
            {error}
          </p>
        )}
      </section>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0 || saving}
          className="inline-flex h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold text-foreground/70 disabled:invisible"
        >
          <ArrowLeft className="size-4" />
          {t("wizard.previous")}
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1a6db5] px-6 text-sm font-bold text-white disabled:opacity-40"
          >
            {t("wizard.next")}
            <ArrowRight className="size-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={create}
            disabled={!canNext || saving}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1a6db5] px-6 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Check className="size-4" />
            )}
            {t("wizard.create")}
          </button>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-bold uppercase text-foreground/60">
        {label}
        {required && <span className="text-[var(--brand-ink)]"> *</span>}
        {hint && (
          <span className="ml-1 font-normal normal-case text-foreground/45">
            {hint}
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function Choice({
  selected,
  onClick,
  icon,
  title,
  text,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "flex min-h-28 flex-col items-start gap-2 rounded-2xl p-4 text-left transition",
        selected
          ? "bg-[#1a6db5] text-white"
          : "bg-foreground/5 text-foreground hover:bg-foreground/10"
      )}
    >
      {icon}
      <span className="tp-title text-lg">{title}</span>
      <span
        className={cn(
          "text-sm",
          selected ? "text-white/85" : "text-foreground/65"
        )}
      >
        {text}
      </span>
    </button>
  );
}

function LevelChip({
  selected,
  onClick,
  label,
  color,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
  color?: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-semibold",
        selected
          ? "bg-[#1a6db5] text-white"
          : "bg-foreground/5 text-foreground hover:bg-foreground/10"
      )}
    >
      {color && (
        <span
          aria-hidden
          className="size-3.5 shrink-0 rounded-full ring-1 ring-black/15"
          style={{ backgroundColor: color }}
        />
      )}
      {label}
    </button>
  );
}
