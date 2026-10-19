"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ASPECTS,
  BALLS,
  type AspectId,
  type BallId,
  type ObjectiveItem,
  type ObjectiveScope,
} from "@/lib/objectives-taxonomy";
import {
  ObjectiveEditor,
  type EditorState,
} from "@/components/objectives/objective-editor";
import { setStudentObjective, setStudentObjectivesBulk } from "./actions";
import {
  createObjective,
  moveObjective,
  removeObjective,
  restoreObjective,
  updateObjective,
} from "./objective-actions";

type BallFilter = BallId | "todas";
type AspectFilter = AspectId | "todos";
type EditScope = "student" | "coach";

/** Ámbitos en los que el usuario puede aplicar cambios para este alumno. */
export type ScopeOption = { id: EditScope; label: string; hint: string };

type Props = {
  studentId: string;
  items: ObjectiveItem[];
  defaultBall: BallId;
  scopes: ScopeOption[];
};

const BALL_COLOR = Object.fromEntries(
  BALLS.map((b) => [b.id, b.color])
) as Record<BallId, string>;
const BALL_LABEL = Object.fromEntries(
  BALLS.map((b) => [b.id, b.label])
) as Record<BallId, string>;

const SCOPE_TAG: Record<ObjectiveScope, string | null> = {
  base: null,
  club: "Del club",
  coach: "Mío",
  student: "Solo este alumno",
};

function chipClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase transition-colors",
    active
      ? "border-brand bg-brand/15 text-brand"
      : "border-border bg-background text-foreground/60 hover:border-brand/40"
  );
}

const iconBtn =
  "inline-flex size-8 items-center justify-center rounded-full text-foreground/45 transition-colors hover:bg-brand/10 hover:text-brand disabled:opacity-40";

export function ObjectivesChecklist({
  studentId,
  items,
  defaultBall,
  scopes,
}: Props) {
  const router = useRouter();
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(items.map((i) => [i.id, i.achieved]))
  );
  const [ball, setBall] = useState<BallFilter>(defaultBall);
  const [aspect, setAspect] = useState<AspectFilter>("todos");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [customizing, setCustomizing] = useState(false);
  const [scope, setScope] = useState<EditScope>(scopes[0]?.id ?? "student");
  const [editor, setEditor] = useState<EditorState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const canCustomize = scopes.length > 0;
  const currentScope = scopes.find((s) => s.id === scope) ?? scopes[0];

  const active = useMemo(() => items.filter((i) => !i.hidden), [items]);
  const hiddenItems = useMemo(() => items.filter((i) => i.hidden), [items]);

  const matches = (i: ObjectiveItem) =>
    (ball === "todas" || i.ball === ball) &&
    (aspect === "todos" || i.aspect === aspect);

  const visible = useMemo(
    () => active.filter(matches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, ball, aspect]
  );
  const visibleHidden = useMemo(
    () => hiddenItems.filter(matches),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hiddenItems, ball, aspect]
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
    const list = active.filter((i) => b === "todas" || i.ball === b);
    return `${list.filter((i) => state[i.id]).length}/${list.length}`;
  }

  // Todo el nivel seleccionado (todas sus bolas de aspecto), sin ocultos.
  const levelItems =
    ball === "todas" ? [] : active.filter((i) => i.ball === ball);
  const levelDone =
    levelItems.length > 0 && levelItems.every((i) => state[i.id]);
  const levelName = ball === "todas" ? "" : BALL_LABEL[ball];

  function toggleLevel() {
    if (levelItems.length === 0) return;
    const next = !levelDone;
    const ids = levelItems.map((i) => i.id);
    const previous = Object.fromEntries(ids.map((id) => [id, !!state[id]]));
    setError(null);
    setState((s) => ({
      ...s,
      ...Object.fromEntries(ids.map((id) => [id, next])),
    }));
    startTransition(async () => {
      try {
        const res = await setStudentObjectivesBulk({
          studentId,
          objectiveIds: ids,
          achieved: next,
        });
        if (!res.ok) throw new Error(res.error);
      } catch {
        setState((s) => ({ ...s, ...previous }));
        setError("No se pudo guardar el cambio. Inténtalo de nuevo.");
      }
    });
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

  /** Ejecuta una acción de personalización y refresca la ficha. */
  function runEdit(
    id: string,
    action: () => Promise<{ ok: boolean; stillHidden?: boolean }>
  ) {
    setError(null);
    setNotice(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) throw new Error("failed");
        if (res.stillHidden)
          setNotice(
            "Sigue oculto para este alumno. Cambia el alcance a «Solo este alumno» para mostrarlo."
          );
        router.refresh();
      } catch {
        setError("No se pudo guardar el cambio. Inténtalo de nuevo.");
      } finally {
        setBusyId(null);
      }
    });
  }

  /** Un objetivo de un alumno concreto no se puede tocar desde un alcance más amplio. */
  function editable(item: ObjectiveItem) {
    return item.scope !== "student" || scope === "student";
  }

  function renderRow(
    item: ObjectiveItem,
    hidden = false,
    pos = { first: true, last: true }
  ) {
    const checked = !!state[item.id];
    const tag = SCOPE_TAG[item.scope];
    const edited = item.overriddenAt.length > 0 && item.scope === "base";
    const canRestore = item.overriddenAt.includes(scope);
    const busy = busyId === item.id;

    return (
      <li key={item.id} className="flex items-start">
        {hidden ? (
          <span className="min-w-0 flex-1 px-3 py-3">
            <span className="block text-[14px] font-semibold leading-snug text-foreground/45 line-through">
              {item.title}
            </span>
            <span className="mt-0.5 block text-[11px] uppercase text-foreground/40">
              Oculto · {BALL_LABEL[item.ball]}
            </span>
          </span>
        ) : (
          <button
            type="button"
            role="checkbox"
            aria-checked={checked}
            onClick={() => toggle(item)}
            className="flex min-w-0 flex-1 items-start gap-3 px-3 py-3 text-left transition-colors hover:bg-brand/5"
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
                checked && <Check className="size-3.5" strokeWidth={3} />
              )}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block text-[14px] font-semibold leading-snug",
                  checked ? "text-foreground/55" : "text-foreground"
                )}
              >
                {item.title}
                {(tag || edited) && (
                  <span className="ml-2 inline-block rounded-full bg-brand/10 px-2 py-0.5 align-middle text-[9px] font-black uppercase text-brand">
                    {tag ?? "Editado"}
                  </span>
                )}
              </span>
              {item.criterion && (
                <span className="mt-0.5 block text-[12px] leading-snug text-foreground/50">
                  {item.criterion}
                </span>
              )}
            </span>
          </button>
        )}

        {customizing && (
          <span className="flex shrink-0 items-center gap-0.5 px-1 py-2">
            {busy ? (
              <Loader2 className="m-2 size-4 animate-spin text-foreground/45" />
            ) : hidden ? (
              <button
                type="button"
                title="Restaurar"
                aria-label="Restaurar objetivo"
                className={iconBtn}
                disabled={!editable(item)}
                onClick={() =>
                  runEdit(item.id, () =>
                    restoreObjective({
                      studentId,
                      scope,
                      objectiveId: item.id,
                    })
                  )
                }
              >
                <RotateCcw className="size-4" />
              </button>
            ) : (
              <>
                <button
                  type="button"
                  title="Subir"
                  aria-label="Subir objetivo"
                  className={iconBtn}
                  disabled={pos.first || !editable(item)}
                  onClick={() =>
                    runEdit(item.id, () =>
                      moveObjective({
                        studentId,
                        scope,
                        objectiveId: item.id,
                        direction: "up",
                      })
                    )
                  }
                >
                  <ChevronUp className="size-4" />
                </button>
                <button
                  type="button"
                  title="Bajar"
                  aria-label="Bajar objetivo"
                  className={iconBtn}
                  disabled={pos.last || !editable(item)}
                  onClick={() =>
                    runEdit(item.id, () =>
                      moveObjective({
                        studentId,
                        scope,
                        objectiveId: item.id,
                        direction: "down",
                      })
                    )
                  }
                >
                  <ChevronDown className="size-4" />
                </button>
                <button
                  type="button"
                  title="Editar"
                  aria-label="Editar objetivo"
                  className={iconBtn}
                  disabled={!editable(item)}
                  onClick={() => setEditor({ mode: "edit", item })}
                >
                  <Pencil className="size-4" />
                </button>
                {canRestore && item.scope === "base" && (
                  <button
                    type="button"
                    title="Volver al original"
                    aria-label="Volver al objetivo original"
                    className={iconBtn}
                    onClick={() =>
                      runEdit(item.id, () =>
                        restoreObjective({
                          studentId,
                          scope,
                          objectiveId: item.id,
                        })
                      )
                    }
                  >
                    <RotateCcw className="size-4" />
                  </button>
                )}
                <button
                  type="button"
                  title="Quitar"
                  aria-label="Quitar objetivo"
                  className={iconBtn}
                  disabled={!editable(item)}
                  onClick={() =>
                    runEdit(item.id, () =>
                      removeObjective({
                        studentId,
                        scope,
                        objectiveId: item.id,
                      })
                    )
                  }
                >
                  <Trash2 className="size-4" />
                </button>
              </>
            )}
          </span>
        )}
      </li>
    );
  }

  return (
    <div className="space-y-5 pt-4">
      {canCustomize && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => {
                setCustomizing((c) => !c);
                setNotice(null);
              }}
              className={chipClass(customizing)}
            >
              <SlidersHorizontal className="size-3.5" />
              Personalizar objetivos
            </button>
            {customizing && (
              <button
                type="button"
                onClick={() => setEditor({ mode: "create" })}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[11px] font-black uppercase text-brand-foreground hover:bg-brand/90"
              >
                <Plus className="size-3.5" />
                Añadir objetivo
              </button>
            )}
          </div>

          {customizing && (
            <div className="space-y-2 rounded-2xl border border-brand/30 bg-brand/5 p-3">
              <p className="text-[10px] font-black uppercase text-foreground/55">
                Aplicar los cambios a
              </p>
              <div className="flex flex-wrap gap-2">
                {scopes.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setScope(s.id)}
                    className={chipClass(scope === s.id)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {currentScope && (
                <p className="text-[12px] leading-snug text-foreground/60">
                  {currentScope.hint} Los objetivos originales de Ten Planner no
                  se modifican: se pueden restaurar en cualquier momento.
                </p>
              )}
            </div>
          )}
        </div>
      )}

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
        {levelItems.length > 0 && (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={toggleLevel}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand/40 px-3 py-1.5 text-[11px] font-black uppercase text-brand transition-colors hover:bg-brand/10"
            >
              <Check className="size-3.5" />
              {levelDone
                ? `Desmarcar todo el nivel ${levelName}`
                : `Marcar todo el nivel ${levelName}`}
            </button>
          </div>
        )}
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
      {notice && (
        <p className="rounded-xl border border-brand/30 bg-brand/10 px-3 py-2 text-[12px] font-semibold text-foreground/70">
          {notice}
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
                  {list.map((item, idx) =>
                    renderRow(item, false, {
                      first: idx === 0,
                      last: idx === list.length - 1,
                    })
                  )}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {customizing && visibleHidden.length > 0 && (
        <section>
          <h3 className="mb-2 text-[11px] font-black uppercase text-foreground/60">
            Objetivos ocultos para este alumno
          </h3>
          <ul className="divide-y divide-[#050505]/10 rounded-2xl border border-dashed border-[#050505]/15 dark:divide-white/10 dark:border-white/15">
            {visibleHidden.map((item) => renderRow(item, true))}
          </ul>
        </section>
      )}

      <ObjectiveEditor
        key={
          editor
            ? editor.mode === "edit"
              ? editor.item.id
              : "create"
            : "closed"
        }
        state={editor}
        description={`${
          scope === "student"
            ? "Se aplicará solo a este alumno."
            : `Se aplicará a: ${(currentScope?.label ?? "").toLowerCase()}.`
        }${
          editor?.mode === "edit" &&
          editor.item.scope === "base" &&
          scope !== "student"
            ? " El objetivo original de Ten Planner no cambia."
            : ""
        }`}
        defaultBall={ball === "todas" ? defaultBall : ball}
        blocks={items}
        onClose={() => setEditor(null)}
        onSubmit={async (values) => {
          const res =
            editor?.mode === "edit"
              ? await updateObjective({
                  studentId,
                  scope,
                  objectiveId: editor.item.id,
                  title: values.title,
                  criterion: values.criterion,
                })
              : await createObjective({
                  studentId,
                  scope,
                  ball: values.ball,
                  aspect: values.aspect,
                  block: values.block,
                  title: values.title,
                  criterion: values.criterion,
                });
          if (res.ok) router.refresh();
          return res.ok;
        }}
      />
    </div>
  );
}
