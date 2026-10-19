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
    const pick = <T>(get: (ov: RawOverride) => T | null): T | null => {
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
      sortOrder: o.sortOrder,
      achieved: marks.has(o.id),
      achievedAt,
      scope,
      hidden: pick((ov) => ov.hidden) ?? false,
      overriddenAt: ovs.map((ov) =>
        ov.studentId ? "student" : ov.clubId ? "club" : "coach"
      ),
    });
  }
  return items;
}
