"use client";

import { useMemo, useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ASPECTS,
  BALLS,
  type AspectId,
  type BallId,
  type ObjectiveItem,
} from "@/lib/objectives-taxonomy";
import { setStudentObjective } from "./actions";

type BallFilter = BallId | "todas";
type AspectFilter = AspectId | "todos";

type Props = {
  studentId: string;
  items: ObjectiveItem[];
  defaultBall: BallId;
};

const BALL_COLOR = Object.fromEntries(
  BALLS.map((b) => [b.id, b.color])
) as Record<BallId, string>;
const BALL_LABEL = Object.fromEntries(
  BALLS.map((b) => [b.id, b.label])
) as Record<BallId, string>;

function chipClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase transition-colors",
    active
      ? "border-brand bg-brand/15 text-brand"
      : "border-border bg-background text-foreground/60 hover:border-brand/40"
  );
}

export function ObjectivesChecklist({ studentId, items, defaultBall }: Props) {
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.achieved]))
  );
  const [ball, setBall] = useState<BallFilter>(defaultBall);
  const [aspect, setAspect] = useState<AspectFilter>("todos");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const visible = useMemo(
    () =>
      items.filter(
        (i) =>
          (ball === "todas" || i.ball === ball) &&
          (aspect === "todos" || i.aspect === aspect)
      ),
    [items, ball, aspect]
  );

  const doneCount = visible.filter((i) => state[i.id]).length;
  const pct = visible.length
    ? Math.round((doneCount / visible.length) * 100)
    : 0;

  const groups = useMemo(() => {
    const map = new Map<string, ObjectiveItem[]>();
    for (const i of visible) {
      const key = `${i.ball}|${i.aspect}|${i.block}`;
      map.set(key, [...(map.get(key) ?? []), i]);
    }
    return Array.from(map, ([key, list]) => ({ key, list }));
  }, [visible]);

  function countFor(b: BallFilter) {
    const list = items.filter((i) => b === "todas" || i.ball === b);
    return `${list.filter((i) => state[i.id]).length}/${list.length}`;
  }

  function toggle(item: ObjectiveItem) {
    const next = !state[item.id];
    setError(null);
    setState((s) => ({ ...s, [item.id]: next }));
    setPendingId(item.id);
    startTransition(async () => {
      try {
        const res = await setStudentObjective({
          studentId,
          objectiveId: item.id,
          achieved: next,
        });
        if (!res.ok) throw new Error(res.error);
      } catch {
        setState((s) => ({ ...s, [item.id]: !next }));
        setError("No se pudo guardar el cambio. Inténtalo de nuevo.");
      } finally {
        setPendingId((p) => (p === item.id ? null : p));
      }
    });
  }

  return (
    <div className="space-y-5 pt-4">
      <div className="flex flex-wrap gap-2">
        {BALLS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBall(b.id)}
            className={chipClass(ball === b.id)}
          >
            <span
              className="size-2.5 rounded-full"
              style={{ backgroundColor: b.color }}
            />
            {b.label} · {b.stage}
            <span className="tabular-nums text-foreground/45">
              {countFor(b.id)}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => setBall("todas")}
          className={chipClass(ball === "todas")}
        >
          Todas
          <span className="tabular-nums text-foreground/45">
            {countFor("todas")}
          </span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setAspect("todos")}
          className={chipClass(aspect === "todos")}
        >
          Todos los aspectos
        </button>
        {ASPECTS.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => setAspect(a.id)}
            className={chipClass(aspect === a.id)}
          >
            {a.label}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[10px] font-black uppercase text-foreground/55">
            Conseguidos
          </span>
          <span className="text-2xl font-black tabular-nums text-foreground">
            {doneCount}/{visible.length} · {pct}%
          </span>
        </div>
        <div className="relative h-px overflow-hidden bg-foreground/10">
          <div
            className="absolute inset-y-0 left-0 h-[3px] -translate-y-px bg-brand"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {error && (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-[12px] font-semibold text-destructive">
          {error}
        </p>
      )}

      {groups.length === 0 ? (
        <p className="text-[13px] text-foreground/55">
          No hay objetivos para este filtro.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map(({ key, list }) => {
            const first = list[0];
            const aspectLabel =
              ASPECTS.find((a) => a.id === first.aspect)?.label ?? first.aspect;
            return (
              <section key={key}>
                <h3 className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-black uppercase text-foreground/60">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: BALL_COLOR[first.ball] }}
                    title={`Bola ${BALL_LABEL[first.ball].toLowerCase()}`}
                  />
                  {first.block}
                  <span className="text-foreground/35">
                    · {aspectLabel}
                    {ball === "todas"
                      ? ` · Bola ${BALL_LABEL[first.ball].toLowerCase()}`
                      : ""}
                  </span>
                </h3>
                <ul className="divide-y divide-[#050505]/10 rounded-2xl border border-[#050505]/10 dark:divide-white/10 dark:border-white/10">
                  {list.map((item) => {
                    const checked = !!state[item.id];
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={checked}
                          onClick={() => toggle(item)}
                          className="flex w-full items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-brand/5"
                        >
                          <span
                            className={cn(
                              "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                              checked
                                ? "border-brand bg-brand text-white"
                                : "border-foreground/30 bg-background"
                            )}
                          >
                            {pendingId === item.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              checked && (
                                <Check className="size-3.5" strokeWidth={3} />
                              )
                            )}
                          </span>
                          <span className="min-w-0">
                            <span
                              className={cn(
                                "block text-[14px] font-semibold leading-snug",
                                checked
                                  ? "text-foreground/55"
                                  : "text-foreground"
                              )}
                            >
                              {item.title}
                            </span>
                            {item.criterion && (
                              <span className="mt-0.5 block text-[12px] leading-snug text-foreground/50">
                                {item.criterion}
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
