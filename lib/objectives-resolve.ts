import type {
  AspectId,
  BallId,
  ObjectiveItem,
  ObjectiveScope,
} from "./objectives-taxonomy";

/** Fila de tennis_objectives con su ámbito (los tres a null = catálogo base). */
export type RawObjective = {
  id: string;
  code: string;
  ball: string;
  aspect: string;
  block: string;
  title: string;
  criterion: string | null;
  source: string;
  sortOrder: number;
  isActive: boolean;
  clubId: string | null;
  coachId: string | null;
  studentId: string | null;
};

/** Fila de objective_overrides. Cada campo a null = sin cambio. */
export type RawOverride = {
  objectiveId: string;
  clubId: string | null;
  coachId: string | null;
  studentId: string | null;
  hidden: boolean | null;
  title: string | null;
  criterion: string | null;
  sortOrder: number | null;
  /** Grupo al que se ha movido (los tres juntos); null = el original. */
  ball?: string | null;
  aspect?: string | null;
  block?: string | null;
};

/**
 * Desde dónde se mira el catálogo. Ficha de alumno: studentId + su club (o
 * null) + su monitor. Espacio del club: studentId null, clubId del club.
 */
export type ScopeContext = {
  studentId: string | null;
  clubId: string | null;
  coachId: string;
};
export type StudentScopeContext = ScopeContext;

/** Ámbito de un objetivo respecto al alumno, o null si no le corresponde. */
export function objectiveScopeFor(
  o: Pick<RawObjective, "clubId" | "coachId" | "studentId">,
  ctx: ScopeContext
): ObjectiveScope | null {
  if (o.studentId) return o.studentId === ctx.studentId ? "student" : null;
  if (o.clubId) return o.clubId === ctx.clubId ? "club" : null;
  if (o.coachId)
    return !ctx.clubId && o.coachId === ctx.coachId ? "coach" : null;
  return "base";
}

/** Nivel de un ajuste respecto al alumno (alumno > club/monitor), o null. */
export function overrideLevelFor(
  o: Pick<RawOverride, "clubId" | "coachId" | "studentId">,
  ctx: ScopeContext
): "student" | "group" | null {
  if (o.studentId) return o.studentId === ctx.studentId ? "student" : null;
  if (o.clubId) return o.clubId === ctx.clubId ? "group" : null;
  if (o.coachId)
    return !ctx.clubId && o.coachId === ctx.coachId ? "group" : null;
  return null;
}

/**
 * Catálogo efectivo de un alumno: objetivos base + los propios que le
 * corresponden (club, monitor o alumno), con los ajustes aplicados. En cada
 * campo gana el ajuste más específico (alumno > club/monitor > original).
 * Los ocultos se devuelven con `hidden: true`; quien los muestre decide.
 */
export function resolveObjectives(
  objectives: RawObjective[],
  overrides: RawOverride[],
  marks: Map<string, string | Date | null>,
  ctx: ScopeContext
): ObjectiveItem[] {
  const byObjective = new Map<string, RawOverride[]>();
  for (const ov of overrides) {
    if (!overrideLevelFor(ov, ctx)) continue;
    byObjective.set(ov.objectiveId, [
      ...(byObjective.get(ov.objectiveId) ?? []),
      ov,
    ]);
  }

  const items: ObjectiveItem[] = [];
  for (const o of objectives) {
    if (!o.isActive) continue;
    const scope = objectiveScopeFor(o, ctx);
    if (!scope) continue;

    // Más específico primero: alumno, luego club/monitor.
    const ovs = (byObjective.get(o.id) ?? []).sort(
      (a, b) =>
        Number(overrideLevelFor(b, ctx) === "student") -
        Number(overrideLevelFor(a, ctx) === "student")
    );
    const pick = <T>(
      get: (ov: RawOverride) => T | null | undefined
    ): T | null => {
      for (const ov of ovs) {
        const v = get(ov);
        if (v !== null && v !== undefined) return v;
      }
      return null;
    };

    // Grupo: el del ajuste más específico que lo haya movido.
    const moved = ovs.find((ov) => ov.ball && ov.aspect && ov.block);

    const done = marks.get(o.id);
    const achievedAt =
      done instanceof Date ? done.toISOString() : (done ?? null);
    items.push({
      id: o.id,
      code: o.code,
      ball: (moved?.ball ?? o.ball) as BallId,
      aspect: (moved?.aspect ?? o.aspect) as AspectId,
      block: moved?.block ?? o.block,
      title: pick((ov) => ov.title) ?? o.title,
      criterion: pick((ov) => ov.criterion) ?? o.criterion,
      source: o.source,
      sortOrder: pick((ov) => ov.sortOrder) ?? o.sortOrder,
      achieved: marks.has(o.id),
      achievedAt,
      scope,
      hidden: pick((ov) => ov.hidden) ?? false,
      // Cuentan como "editado" los cambios de texto, ocultar o moverlo de
      // grupo; el orden dentro del grupo no.
      overriddenAt: ovs
        .filter(
          (ov) =>
            ov.title !== null ||
            ov.criterion !== null ||
            ov.hidden !== null ||
            !!ov.block
        )
        .map((ov) => (ov.studentId ? "student" : ov.clubId ? "club" : "coach")),
    });
  }
  return items.sort(
    (a, b) =>
      BALL_ORDER[a.ball] - BALL_ORDER[b.ball] ||
      a.sortOrder - b.sortOrder ||
      a.code.localeCompare(b.code)
  );
}

const BALL_ORDER: Record<BallId, number> = { roja: 0, naranja: 1, verde: 2 };

/**
 * Plan para subir/bajar un objetivo dentro de su grupo (misma bola, aspecto y
 * bloque, sin ocultos): intercambia su posición con la de su vecino y reparte
 * entre los dos las mismas posiciones del grupo, sin mover los demás grupos.
 * Devuelve los nuevos valores de orden o null si no hay vecino en esa dirección.
 */
export function planMove(
  items: ObjectiveItem[],
  objectiveId: string,
  direction: "up" | "down"
): { id: string; sortOrder: number }[] | null {
  const target = items.find((i) => i.id === objectiveId && !i.hidden);
  if (!target) return null;
  const group = items
    .filter(
      (i) =>
        !i.hidden &&
        i.ball === target.ball &&
        i.aspect === target.aspect &&
        i.block === target.block
    )
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const idx = group.findIndex((i) => i.id === objectiveId);
  const other = direction === "up" ? idx - 1 : idx + 1;
  if (other < 0 || other >= group.length) return null;

  const next = [...group];
  [next[idx], next[other]] = [next[other], next[idx]];
  const slots = group.map((i) => i.sortOrder);
  return next
    .map((item, k) => ({
      id: item.id,
      from: item.sortOrder,
      sortOrder: slots[k],
    }))
    .filter((change) => change.from !== change.sortOrder)
    .map(({ id, sortOrder }) => ({ id, sortOrder }));
}

/** Grupo de objetivos: misma bola, aspecto y bloque. */
export type ObjectiveGroupKey = { ball: string; aspect: string; block: string };

export type PlaceChange = {
  id: string;
  sortOrder: number;
  /** Solo en el objetivo arrastrado, si cambia de grupo. */
  group?: ObjectiveGroupKey;
};

function sameGroup(a: ObjectiveGroupKey, b: ObjectiveGroupKey) {
  return a.ball === b.ball && a.aspect === b.aspect && a.block === b.block;
}

/**
 * Plan para arrastrar un objetivo a cualquier posición: dentro de su grupo o a
 * otro grupo (otra bola, aspecto o bloque), justo antes de `beforeId` o al
 * final si es null. Reparte las posiciones del grupo de destino (y, si el
 * objetivo viene de otro grupo, una más) sin tocar los demás grupos. Devuelve
 * solo lo que cambia, o null si el objetivo no existe o ya está ahí.
 */
export function planPlace(
  items: ObjectiveItem[],
  objectiveId: string,
  target: ObjectiveGroupKey,
  beforeId: string | null
): PlaceChange[] | null {
  const moving = items.find((i) => i.id === objectiveId && !i.hidden);
  if (!moving || beforeId === objectiveId) return null;
  const crossGroup = !sameGroup(moving, target);

  const groupItems = items
    .filter((i) => !i.hidden && sameGroup(i, target))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));
  const others = groupItems.filter((i) => i.id !== objectiveId);
  const at = beforeId ? others.findIndex((i) => i.id === beforeId) : -1;
  const next = [...others];
  next.splice(at < 0 ? next.length : at, 0, moving);

  // Mismas posiciones que ya tenía el grupo; si llega de fuera, una más al
  // final. Si había posiciones repetidas, se numeran seguidas desde la menor.
  let slots = groupItems.map((i) => i.sortOrder);
  if (crossGroup)
    slots.push(slots.length ? Math.max(...slots) + 1 : moving.sortOrder);
  slots.sort((a, b) => a - b);
  if (new Set(slots).size !== slots.length)
    slots = slots.map((_, k) => slots[0] + k);

  const changes: PlaceChange[] = [];
  next.forEach((item, k) => {
    const isMoving = item.id === objectiveId;
    if (isMoving && crossGroup)
      changes.push({ id: item.id, sortOrder: slots[k], group: target });
    else if (item.sortOrder !== slots[k])
      changes.push({ id: item.id, sortOrder: slots[k] });
  });
  return changes.length ? changes : null;
}
