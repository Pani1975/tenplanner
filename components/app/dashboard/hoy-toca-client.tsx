"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  Minus,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Shuffle,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BLOCK_TITLES,
  FOCUS_LABELS,
  HOY_TOCA,
  MONTAR,
  INTENSITY_LABELS,
  SLOT_LABELS,
} from "@/lib/session-engine/messages";
import {
  DURATIONS,
  type Duration,
  type Focus,
  type Intensity,
  type PlanItem,
} from "@/lib/session-engine/types";
import type { Proposal } from "@/lib/session-engine/today";

const FOCUS_OPTIONS: Focus[] = [
  "auto",
  "derecha",
  "reves",
  "saque",
  "resto",
  "volea",
  "remate",
  "tactica",
  "fisico",
];
const INTENSITIES: Intensity[] = ["suave", "media", "alta"];
const INTENSITY_VALUE: Record<Intensity, number> = {
  suave: 2,
  media: 3,
  alta: 4,
};
const PHASE_COLOR: Record<PlanItem["phase"], string> = {
  activation: "bg-[#FB8C00]",
  main: "bg-[#D6FF38]",
  cooldown: "bg-[#43A047]",
};

type Item = PlanItem & { key: string };

function withKeys(items: PlanItem[]): Item[] {
  return items.map((it) => ({
    ...it,
    key: `${it.slotIndex}-${it.exerciseId}`,
  }));
}

export function HoyTocaClient({
  initial,
  date,
  scheduledAt,
  kicker = HOY_TOCA.kicker,
  targetSession,
}: {
  initial: Proposal;
  date: string;
  scheduledAt: string;
  /** Rótulo de sección (por defecto "Hoy toca"). */
  kicker?: string;
  /**
   * Sesión ya programada a la que va la propuesta: al aceptarla se
   * sustituyen sus ejercicios (con aviso si tenía). Sin ella, se crea una
   * sesión nueva.
   */
  targetSession?: { id: string; title: string; itemCount: number };
}) {
  const router = useRouter();
  const group = initial.group;
  const [attendees, setAttendees] = useState<Set<string>>(
    new Set(initial.input.attendeeIds)
  );
  const [duration, setDuration] = useState<Duration>(
    initial.input.durationMinutes
  );
  const [intensity, setIntensity] = useState<Intensity>(
    initial.input.intensity
  );
  const [focus, setFocus] = useState<Focus>(initial.input.focus);
  const [plan, setPlan] = useState(initial.plan);
  const [lastInput, setLastInput] = useState(initial.input);
  const [items, setItems] = useState<Item[]>(withKeys(initial.plan.items));
  const [variant, setVariant] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = useMemo(
    () => items.reduce((n, it) => n + it.minutes, 0),
    [items]
  );
  const when = new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Madrid",
  }).format(new Date(scheduledAt));

  async function request(
    body: Record<string, unknown>,
    tag: string,
    onPlan?: (items: PlanItem[]) => Item[]
  ) {
    setBusy(tag);
    setError(null);
    try {
      const res = await fetch("/api/sessions/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: group.id,
          date,
          durationMinutes: duration,
          intensity,
          focus,
          attendeeIds: [...attendees],
          ...body,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { data } = (await res.json()) as { data: Proposal };
      setPlan(data.plan);
      setLastInput(data.input);
      setItems(onPlan ? onPlan(data.plan.items) : withKeys(data.plan.items));
    } catch {
      setError(HOY_TOCA.error);
    } finally {
      setBusy(null);
    }
  }

  /** Cambia un parámetro y vuelve a montar la clase desde cero. */
  function regenerate(over: Record<string, unknown>) {
    setVariant(0);
    void request({ ...over, variant: 0 }, "all");
  }

  function anotherProposal() {
    const v = variant + 1;
    setVariant(v);
    void request(
      {
        variant: v,
        previousIds: items.map((i) => i.exerciseId),
        pinned: items
          .filter((i) => i.pinned)
          .map((i) => ({
            slotIndex: i.slotIndex,
            exerciseId: i.exerciseId,
            minutes: i.minutes,
          })),
      },
      "all"
    );
  }

  /** Más fácil / más difícil / cambiar: solo ese hueco; el resto se queda. */
  function adjustSlot(it: Item, levelShift: -1 | 0 | 1) {
    void request(
      {
        variant,
        pinned: items
          .filter((x) => x.slotIndex !== it.slotIndex)
          .map((x) => ({
            slotIndex: x.slotIndex,
            exerciseId: x.exerciseId,
            minutes: x.minutes,
          })),
        slotAdjust: {
          slotIndex: it.slotIndex,
          levelShift,
          excludeIds: [it.exerciseId],
        },
      },
      it.key,
      // Conserva el orden, los fijados y lo quitado: solo cambia ese hueco.
      (fresh) => {
        const repl = fresh.find((f) => f.slotIndex === it.slotIndex);
        return items.map((x) =>
          x.slotIndex === it.slotIndex && repl
            ? {
                ...repl,
                key: `${repl.slotIndex}-${repl.exerciseId}`,
                pinned: false,
              }
            : x
        );
      }
    );
  }

  function update(key: string, fn: (it: Item) => Item | null) {
    setItems((prev) =>
      prev.flatMap((it) => {
        if (it.key !== key) return [it];
        const next = fn(it);
        return next ? [next] : [];
      })
    );
  }

  function move(key: string, dir: -1 | 1) {
    setItems((prev) => {
      const i = prev.findIndex((x) => x.key === key);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      if (prev[i].phase !== prev[j].phase) return prev; // no se cruzan bloques
      const copy = [...prev];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  async function save() {
    setSaving(true);
    setError(null);
    const phases = ["activation", "main", "cooldown"] as const;
    const blocks = phases.map((phase, b) => ({
      orderIndex: b + 1,
      title: BLOCK_TITLES[phase],
      items: items
        .filter((it) => it.phase === phase)
        .map((it) => ({
          kind: "exercise" as const,
          exerciseId: it.exerciseId,
          durationMinutes: it.minutes,
        })),
    }));
    const absentStudentIds = group.students
      .map((s) => s.id)
      .filter((id) => !attendees.has(id));
    const generation = {
      input: { ...lastInput, attendeeIds: [...attendees] },
      trace: { explanations: plan.explanations, slots: plan.trace },
    };

    // Sesión ya programada: se sustituye su plan con la edición normal de
    // sesión (mismos permisos y misma lógica que el asistente).
    if (targetSession) {
      try {
        const res = await fetch(`/api/sessions/${targetSession.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            blocks,
            durationMinutes: total,
            durationManual: true,
            intensity: INTENSITY_VALUE[intensity],
            absentStudentIds,
            generation,
          }),
        });
        if (!res.ok) throw new Error(String(res.status));
        router.push(`/sessions/${targetSession.id}`);
      } catch {
        setError(HOY_TOCA.saveError);
        setSaving(false);
      }
      return;
    }

    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `${group.name} · ${new Intl.DateTimeFormat("es-ES", {
            day: "numeric",
            month: "short",
            timeZone: "Europe/Madrid",
          }).format(new Date(scheduledAt))}`,
          scheduledAt,
          durationMinutes: total,
          durationManual: true,
          intensity: INTENSITY_VALUE[intensity],
          groupId: group.id,
          studentIds: [],
          exercises: [],
          blocks,
          createdVia: "engine",
          absentStudentIds,
          generation,
        }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const { data } = (await res.json()) as { data: { id: string } };
      router.push(`/sessions/${data.id}`);
    } catch {
      setError(HOY_TOCA.saveError);
      setSaving(false);
    }
  }

  const chip = (active: boolean) =>
    cn(
      "min-h-11 rounded-full border px-3 text-sm font-semibold transition-colors",
      active
        ? "border-[#050505] bg-[#050505] text-white dark:border-[#D6FF38] dark:bg-[#D6FF38] dark:text-[#050505]"
        : "border-foreground/15 text-foreground hover:bg-muted"
    );
  const loadingAll = busy === "all";

  return (
    <section
      aria-labelledby="hoy-toca-title"
      className="rounded-lg border border-[#050505]/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.04] sm:p-6"
    >
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {kicker}
      </p>
      <h2
        id="hoy-toca-title"
        className="mt-1 text-xl font-black text-foreground"
      >
        {HOY_TOCA.title}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        <span className="font-semibold text-foreground">{group.name}</span> ·{" "}
        {when}
      </p>
      {targetSession && (
        <p className="mt-1 text-sm font-semibold text-foreground">
          {MONTAR.forSession(targetSession.title)} ·{" "}
          <span className="font-normal text-muted-foreground">
            {MONTAR.itemCount(targetSession.itemCount)}
          </span>
        </p>
      )}

      <div className="mt-4 space-y-3">
        {group.students.length > 0 ? (
          <fieldset>
            <legend className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
              {HOY_TOCA.comingToday} ·{" "}
              {HOY_TOCA.students(attendees.size, group.students.length)}
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {group.students.map((s) => {
                const on = attendees.has(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={on}
                    disabled={!!busy}
                    onClick={() => {
                      const next = new Set(attendees);
                      if (on) next.delete(s.id);
                      else next.add(s.id);
                      setAttendees(next);
                      setVariant(0);
                      void request(
                        { attendeeIds: [...next], variant: 0 },
                        "all"
                      );
                    }}
                    className={chip(on)}
                  >
                    {s.name.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : (
          <p className="text-sm text-muted-foreground">{HOY_TOCA.noStudents}</p>
        )}

        <ChipRow label={HOY_TOCA.duration}>
          {DURATIONS.map((d) => (
            <button
              key={d}
              type="button"
              aria-pressed={duration === d}
              disabled={!!busy}
              onClick={() => {
                setDuration(d);
                regenerate({ durationMinutes: d });
              }}
              className={chip(duration === d)}
            >
              {d}
            </button>
          ))}
        </ChipRow>

        <ChipRow label={HOY_TOCA.intensity}>
          {INTENSITIES.map((i) => (
            <button
              key={i}
              type="button"
              aria-pressed={intensity === i}
              disabled={!!busy}
              onClick={() => {
                setIntensity(i);
                regenerate({ intensity: i });
              }}
              className={chip(intensity === i)}
            >
              {INTENSITY_LABELS[i]}
            </button>
          ))}
        </ChipRow>

        <ChipRow label={HOY_TOCA.focus}>
          {FOCUS_OPTIONS.map((f) => (
            <button
              key={f}
              type="button"
              aria-pressed={focus === f}
              disabled={!!busy}
              onClick={() => {
                setFocus(f);
                regenerate({ focus: f });
              }}
              className={chip(focus === f)}
            >
              {FOCUS_LABELS[f]}
            </button>
          ))}
        </ChipRow>
      </div>

      {plan.explanations.length > 0 && (
        <ul className="mt-4 space-y-1 rounded-md bg-muted/60 p-3 text-sm text-foreground">
          {plan.explanations.map((t) => (
            <li key={t} className="flex gap-2">
              <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Barra de tiempo: suma exacta de la duración elegida. */}
      <div className="mt-4">
        <div
          className="flex h-3 w-full overflow-hidden rounded-full bg-muted"
          aria-hidden
        >
          {items.map((it) => (
            <div
              key={it.key}
              className={cn(
                PHASE_COLOR[it.phase],
                "border-r border-white/60 last:border-r-0"
              )}
              style={{
                width: `${(it.minutes / Math.max(total, duration)) * 100}%`,
              }}
            />
          ))}
        </div>
        <p className="mt-1 text-right text-xs font-semibold text-muted-foreground">
          {HOY_TOCA.minutesOf(total, duration)}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {HOY_TOCA.noExercises}
        </p>
      ) : (
        <ol className={cn("mt-3 space-y-2", loadingAll && "opacity-50")}>
          {items.map((it, idx) => (
            <li
              key={it.key}
              className="rounded-md border border-foreground/10 p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                    {SLOT_LABELS[it.kind]}
                    {it.pinned && " · 📌"}
                  </p>
                  <a
                    href={`/exercises/${it.exerciseId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-foreground hover:underline"
                  >
                    {it.name}
                  </a>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <IconButton
                    label={HOY_TOCA.lessMin}
                    onClick={() =>
                      update(it.key, (x) => ({
                        ...x,
                        minutes: Math.max(1, x.minutes - 1),
                      }))
                    }
                  >
                    <Minus className="size-4" />
                  </IconButton>
                  <span className="w-12 text-center text-sm font-bold tabular-nums">
                    {it.minutes}&#8242;
                  </span>
                  <IconButton
                    label={HOY_TOCA.moreMin}
                    onClick={() =>
                      update(it.key, (x) => ({
                        ...x,
                        minutes: Math.min(120, x.minutes + 1),
                      }))
                    }
                  >
                    <Plus className="size-4" />
                  </IconButton>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-1">
                <SmallButton
                  disabled={!!busy}
                  onClick={() => adjustSlot(it, -1)}
                >
                  <ChevronDown className="size-3.5" /> {HOY_TOCA.easier}
                </SmallButton>
                <SmallButton
                  disabled={!!busy}
                  onClick={() => adjustSlot(it, 1)}
                >
                  <ChevronUp className="size-3.5" /> {HOY_TOCA.harder}
                </SmallButton>
                <SmallButton
                  disabled={!!busy}
                  onClick={() => adjustSlot(it, 0)}
                >
                  {busy === it.key ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="size-3.5" />
                  )}{" "}
                  {HOY_TOCA.change}
                </SmallButton>
                <SmallButton
                  pressed={it.pinned}
                  onClick={() =>
                    update(it.key, (x) => ({ ...x, pinned: !x.pinned }))
                  }
                >
                  {it.pinned ? (
                    <PinOff className="size-3.5" />
                  ) : (
                    <Pin className="size-3.5" />
                  )}{" "}
                  {it.pinned ? HOY_TOCA.unpin : HOY_TOCA.pin}
                </SmallButton>
                <span className="ml-auto flex items-center gap-1">
                  <IconButton
                    label={HOY_TOCA.up}
                    disabled={idx === 0 || items[idx - 1].phase !== it.phase}
                    onClick={() => move(it.key, -1)}
                  >
                    <ArrowUp className="size-4" />
                  </IconButton>
                  <IconButton
                    label={HOY_TOCA.down}
                    disabled={
                      idx === items.length - 1 ||
                      items[idx + 1].phase !== it.phase
                    }
                    onClick={() => move(it.key, 1)}
                  >
                    <ArrowDown className="size-4" />
                  </IconButton>
                  <IconButton
                    label={HOY_TOCA.remove}
                    onClick={() => update(it.key, () => null)}
                  >
                    <X className="size-4" />
                  </IconButton>
                </span>
              </div>
            </li>
          ))}
        </ol>
      )}

      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

      {confirmReplace && targetSession && (
        <div
          role="alertdialog"
          aria-labelledby="replace-warning"
          className="mt-4 rounded-md border border-[#FB8C00]/40 bg-[#FB8C00]/10 p-3"
        >
          <p
            id="replace-warning"
            className="text-sm font-semibold text-foreground"
          >
            {MONTAR.replaceWarning(
              targetSession.itemCount,
              targetSession.title
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setConfirmReplace(false);
                void save();
              }}
              className="inline-flex min-h-11 items-center rounded-full bg-[#D6FF38] px-4 text-sm font-bold text-[#050505]"
            >
              {MONTAR.confirmReplace}
            </button>
            <button
              type="button"
              onClick={() => setConfirmReplace(false)}
              className="inline-flex min-h-11 items-center rounded-full border border-foreground/15 px-4 text-sm font-bold text-foreground hover:bg-muted"
            >
              {MONTAR.cancel}
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={anotherProposal}
          disabled={!!busy || saving}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-foreground/15 px-4 text-sm font-bold text-foreground hover:bg-muted disabled:opacity-50"
        >
          {loadingAll ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Shuffle className="size-4" />
          )}
          {loadingAll ? HOY_TOCA.loading : HOY_TOCA.another}
        </button>
        <button
          type="button"
          onClick={() => {
            // Sustituir el contenido de una sesión que ya tiene ejercicios
            // pide confirmación antes.
            if (targetSession && targetSession.itemCount > 0) {
              setConfirmReplace(true);
              return;
            }
            void save();
          }}
          disabled={!!busy || saving || confirmReplace || items.length === 0}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#D6FF38] px-5 text-sm font-bold text-[#050505] hover:bg-[#c8ef2f] disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {saving
            ? HOY_TOCA.saving
            : targetSession
              ? MONTAR.useInSession
              : HOY_TOCA.save}
        </button>
      </div>
    </section>
  );
}

function ChipRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-11 items-center justify-center rounded-md text-foreground hover:bg-muted disabled:opacity-30"
    >
      {children}
    </button>
  );
}

function SmallButton({
  onClick,
  disabled,
  pressed,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      className={cn(
        "inline-flex min-h-11 items-center gap-1 rounded-full border px-3 text-xs font-semibold disabled:opacity-50",
        pressed
          ? "border-[#050505] bg-[#050505] text-white dark:border-[#D6FF38] dark:bg-[#D6FF38] dark:text-[#050505]"
          : "border-foreground/15 text-foreground hover:bg-muted"
      )}
    >
      {children}
    </button>
  );
}
