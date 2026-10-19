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

    const done = marks.get(o.id);
    const achievedAt =
      done instanceof Date ? done.toISOString() : (done ?? null);
    items.push({
      id: o.id,
      code: o.code,
      ball: o.ball as BallId,
      aspect: o.aspect as AspectId,
      block: o.block,
      title: pick((ov) => ov.title) ?? o.title,
      criterion: pick((ov) => ov.criterion) ?? o.criterion,
      source: o.source,
      sortOrder: pick((ov) => ov.sortOrder) ?? o.sortOrder,
      achieved: marks.has(o.id),
      achievedAt,
      scope,
      hidden: pick((ov) => ov.hidden) ?? false,
      // Solo cuentan como "editado" los cambios de texto u ocultar; el orden no.
      overriddenAt: ovs
        .filter(
          (ov) =>
            ov.title !== null || ov.criterion !== null || ov.hidden !== null
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
