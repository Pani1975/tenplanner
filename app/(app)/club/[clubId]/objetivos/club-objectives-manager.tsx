"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ASPECTS,
  BALLS,
  type AspectId,
  type BallId,
  type ObjectiveItem,
} from "@/lib/objectives-taxonomy";
import {
  ObjectiveEditor,
  type EditorState,
  type EditorValues,
} from "@/components/objectives/objective-editor";
import {
  createClubObjective,
  removeClubObjective,
  restoreClubObjective,
  updateClubObjective,
} from "./actions";

type BallFilter = BallId | "todas";
type AspectFilter = AspectId | "todos";

const BALL_LABEL = Object.fromEntries(
  BALLS.map((b) => [b.id, b.label])
) as Record<BallId, string>;
const BALL_COLOR = Object.fromEntries(
  BALLS.map((b) => [b.id, b.color])
) as Record<BallId, string>;

const TAG: Record<ObjectiveItem["scope"], string | null> = {
  base: null,
  club: "Del club",
  coach: "Monitor",
  student: "Alumno",
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

export function ClubObjectivesManager({
  clubId,
  items,
}: {
  clubId: string;
  items: ObjectiveItem[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [ball, setBall] = useState<BallFilter>("roja");
  const [aspect, setAspect] = useState<AspectFilter>("todos");
  const [editor, setEditor] = useState<EditorState>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const matches = (i: ObjectiveItem) =>
    (ball === "todas" || i.ball === ball) &&
    (aspect === "todos" || i.aspect === aspect);

  const visible = useMemo(
    () => items.filter((i) => !i.hidden && matches(i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, ball, aspect]
  );
  const hidden = useMemo(
    () => items.filter((i) => i.hidden && matches(i)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, ball, aspect]
  );

  const groups = useMemo(() => {
    const map = new Map<string, ObjectiveItem[]>();
    for (const i of visible) {
      const key = `${i.ball}|${i.aspect}|${i.block}`;
      map.set(key, [...(map.get(key) ?? []), i]);
    }
    return Array.from(map, ([key, list]) => ({ key, list }));
  }, [visible]);

  function countFor(b: BallFilter) {
    return items.filter((i) => !i.hidden && (b === "todas" || i.ball === b))
      .length;
  }

  function run(id: string, action: () => Promise<{ ok: boolean }>) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      try {
        const res = await action();
        if (!res.ok) throw new Error("failed");
        router.refresh();
      } catch {
        setError("No se pudo guardar el cambio. Inténtalo de nuevo.");
      } finally {
        setBusyId(null);
      }
    });
  }

  function renderRow(item: ObjectiveItem, isHidden: boolean) {
    const tag = TAG[item.scope];
    const edited = item.overriddenAt.length > 0 && item.scope === "base";
    const busy = busyId === item.id;
    return (
      <li key={item.id} className="flex items-start">
        <div className="min-w-0 flex-1 px-3 py-3">
          <span
            className={cn(
              "block text-[14px] font-semibold leading-snug",
              isHidden ? "text-foreground/45 line-through" : "text-foreground"
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
          {isHidden && (
            <span className="mt-0.5 block text-[11px] uppercase text-foreground/40">
              Oculto para el club
            </span>
          )}
        </div>
        <span className="flex shrink-0 items-center gap-0.5 px-1 py-2">
          {busy ? (
            <Loader2 className="m-2 size-4 animate-spin text-foreground/45" />
          ) : isHidden ? (
            <button
              type="button"
              title="Restaurar"
              aria-label="Restaurar objetivo"
              className={iconBtn}
              onClick={() =>
                run(item.id, () =>
                  restoreClubObjective({ clubId, objectiveId: item.id })
                )
              }
            >
              <RotateCcw className="size-4" />
            </button>
          ) : (
            <>
              <button
                type="button"
                title="Editar"
                aria-label="Editar objetivo"
                className={iconBtn}
                onClick={() => setEditor({ mode: "edit", item })}
              >
                <Pencil className="size-4" />
              </button>
              {item.overriddenAt.includes("club") && item.scope === "base" && (
                <button
                  type="button"
                  title="Volver al original"
                  aria-label="Volver al objetivo original"
                  className={iconBtn}
                  onClick={() =>
                    run(item.id, () =>
                      restoreClubObjective({ clubId, objectiveId: item.id })
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
                onClick={() =>
                  run(item.id, () =>
                    removeClubObjective({ clubId, objectiveId: item.id })
                  )
                }
              >
                <Trash2 className="size-4" />
              </button>
            </>
          )}
        </span>
      </li>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
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
        <button
          type="button"
          onClick={() => setEditor({ mode: "create" })}
          className="inline-flex items-center gap-1.5 rounded-full bg-brand px-3 py-1.5 text-[11px] font-black uppercase text-brand-foreground hover:bg-brand/90"
        >
          <Plus className="size-3.5" />
          Añadir objetivo
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
                  />
                  {first.block}
                  <span className="text-foreground/35">
                    · {aspectLabel} · Bola{" "}
                    {BALL_LABEL[first.ball].toLowerCase()}
                  </span>
                </h3>
                <ul className="divide-y divide-[#050505]/10 rounded-2xl border border-[#050505]/10 dark:divide-white/10 dark:border-white/10">
                  {list.map((item) => renderRow(item, false))}
                </ul>
              </section>
            );
          })}
        </div>
      )}

      {hidden.length > 0 && (
        <section>
          <h3 className="mb-2 text-[11px] font-black uppercase text-foreground/60">
            Ocultos para el club
          </h3>
          <ul className="divide-y divide-[#050505]/10 rounded-2xl border border-dashed border-[#050505]/15 dark:divide-white/10 dark:border-white/15">
            {hidden.map((item) => renderRow(item, true))}
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
        description="Se aplicará a todos los alumnos del club. El original de Ten Planner no cambia."
        defaultBall={ball === "todas" ? "roja" : ball}
        blocks={items}
        onClose={() => setEditor(null)}
        onSubmit={async (values: EditorValues) => {
          const res =
            editor?.mode === "edit"
              ? await updateClubObjective({
                  clubId,
                  objectiveId: editor.item.id,
                  title: values.title,
                  criterion: values.criterion,
                })
              : await createClubObjective({
                  clubId,
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
