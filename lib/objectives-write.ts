import { randomBytes } from "crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { objectiveOverrides, tennisObjectives } from "@/db/schema";
import {
  BALLS,
  type AspectId,
  type BallId,
  type ObjectiveItem,
} from "./objectives-taxonomy";
import {
  objectiveScopeFor,
  planMove,
  type ScopeContext,
} from "./objectives-resolve";

// Escritura de objetivos propios y ajustes, compartida por la ficha del alumno
// y el espacio del club. Las comprobaciones de acceso se hacen fuera.

/** Ámbito al que se aplica un cambio. */
export type WriteScope = "student" | "club" | "coach";

export type WriteFailure = { ok: false; error: string };
export type WriteOk = { ok: true };

function scopeColumns(scope: WriteScope, ctx: ScopeContext) {
  return {
    clubId: scope === "club" ? ctx.clubId : null,
    coachId: scope === "coach" ? ctx.coachId : null,
    studentId: scope === "student" ? ctx.studentId : null,
  };
}

function overrideWhere(
  objectiveId: string,
  scope: WriteScope,
  ctx: ScopeContext
) {
  const col =
    scope === "club"
      ? eq(objectiveOverrides.clubId, ctx.clubId ?? "")
      : scope === "coach"
        ? eq(objectiveOverrides.coachId, ctx.coachId)
        : eq(objectiveOverrides.studentId, ctx.studentId ?? "");
  return and(eq(objectiveOverrides.objectiveId, objectiveId), col)!;
}

/** Objetivo activo que además es visible desde este contexto. */
async function loadVisibleObjective(objectiveId: string, ctx: ScopeContext) {
  const [o] = await db
    .select()
    .from(tennisObjectives)
    .where(
      and(
        eq(tennisObjectives.id, objectiveId),
        eq(tennisObjectives.isActive, true)
      )
    )
    .limit(1);
  if (!o) return null;
  const own = objectiveScopeFor(o, ctx);
  return own ? { objective: o, ownScope: own } : null;
}

/** Un objetivo propio de un alumno no se toca desde un ámbito más amplio. */
function allowedFor(ownScope: string, scope: WriteScope) {
  return ownScope !== "student" || scope === "student";
}

type OverridePatch = {
  hidden?: boolean | null;
  title?: string | null;
  criterion?: string | null;
  sortOrder?: number | null;
};

async function upsertOverride(
  objectiveId: string,
  scope: WriteScope,
  ctx: ScopeContext,
  userId: string,
  patch: OverridePatch
) {
  const [existing] = await db
    .select({ id: objectiveOverrides.id })
    .from(objectiveOverrides)
    .where(overrideWhere(objectiveId, scope, ctx))
    .limit(1);
  if (existing) {
    await db
      .update(objectiveOverrides)
      .set({ ...patch, updatedBy: userId })
      .where(eq(objectiveOverrides.id, existing.id));
  } else {
    await db.insert(objectiveOverrides).values({
      objectiveId,
      ...scopeColumns(scope, ctx),
      hidden: null,
      title: null,
      criterion: null,
      ...patch,
      updatedBy: userId,
    });
  }
}

/** Crea un objetivo propio en el ámbito indicado. */
export async function createOwnObjective(
  ctx: ScopeContext,
  scope: WriteScope,
  userId: string,
  input: {
    ball: string;
    aspect: string;
    block: string;
    title: string;
    criterion: string | null;
  }
): Promise<WriteOk | WriteFailure> {
  const ball = BALLS.find((b) => b.id === input.ball);
  if (!ball) return { ok: false, error: "Invalid ball" };
  const [last] = await db
    .select({ sortOrder: tennisObjectives.sortOrder })
    .from(tennisObjectives)
    .where(eq(tennisObjectives.ball, input.ball as BallId))
    .orderBy(desc(tennisObjectives.sortOrder))
    .limit(1);

  await db.insert(tennisObjectives).values({
    code: `CU-${randomBytes(5).toString("hex").toUpperCase()}`,
    ball: input.ball,
    stage: ball.stage,
    ageRange: ball.age,
    aspect: input.aspect as AspectId,
    block: input.block,
    title: input.title,
    criterion: input.criterion,
    source: "propio",
    sortOrder: (last?.sortOrder ?? 0) + 1,
    createdBy: userId,
    ...scopeColumns(scope, ctx),
  });
  return { ok: true };
}

/**
 * Cambia título y criterio. Si el objetivo es de este mismo ámbito se edita
 * directamente; si no, se guarda un ajuste que solo aplica a este ámbito.
 */
export async function updateObjectiveText(
  ctx: ScopeContext,
  scope: WriteScope,
  userId: string,
  objectiveId: string,
  text: { title: string; criterion: string }
): Promise<WriteOk | WriteFailure> {
  const found = await loadVisibleObjective(objectiveId, ctx);
  if (!found || !allowedFor(found.ownScope, scope))
    return { ok: false, error: "Not found" };

  if (found.ownScope === scope) {
    await db
      .update(tennisObjectives)
      .set({ title: text.title, criterion: text.criterion || null })
      .where(eq(tennisObjectives.id, objectiveId));
  } else {
    const o = found.objective;
    await upsertOverride(objectiveId, scope, ctx, userId, {
      title: text.title === o.title ? null : text.title,
      criterion: text.criterion === (o.criterion ?? "") ? null : text.criterion,
    });
  }
  return { ok: true };
}

/**
 * Quita un objetivo en el ámbito indicado. Uno propio de ese ámbito se
 * desactiva (las marcas se conservan); cualquier otro se oculta.
 */
export async function removeObjectiveFor(
  ctx: ScopeContext,
  scope: WriteScope,
  userId: string,
  objectiveId: string
): Promise<WriteOk | WriteFailure> {
  const found = await loadVisibleObjective(objectiveId, ctx);
  if (!found || !allowedFor(found.ownScope, scope))
    return { ok: false, error: "Not found" };

  if (found.ownScope === scope) {
    await db
      .update(tennisObjectives)
      .set({ isActive: false })
      .where(eq(tennisObjectives.id, objectiveId));
  } else {
    await upsertOverride(objectiveId, scope, ctx, userId, { hidden: true });
  }
  return { ok: true };
}

/**
 * Borra el ajuste de este ámbito (vuelve el original). Devuelve si el objetivo
 * sigue oculto para el alumno por un ajuste del club/monitor.
 */
export async function restoreObjectiveFor(
  ctx: ScopeContext,
  scope: WriteScope,
  userId: string,
  objectiveId: string
): Promise<(WriteOk & { stillHidden: boolean }) | WriteFailure> {
  const found = await loadVisibleObjective(objectiveId, ctx);
  if (!found || !allowedFor(found.ownScope, scope))
    return { ok: false, error: "Not found" };

  await db
    .delete(objectiveOverrides)
    .where(overrideWhere(objectiveId, scope, ctx));

  if (scope === "student" && ctx.studentId) {
    const [wider] = await db
      .select({ hidden: objectiveOverrides.hidden })
      .from(objectiveOverrides)
      .where(
        and(
          eq(objectiveOverrides.objectiveId, objectiveId),
          ctx.clubId
            ? eq(objectiveOverrides.clubId, ctx.clubId)
            : eq(objectiveOverrides.coachId, ctx.coachId)
        )
      )
      .limit(1);
    if (wider?.hidden) {
      // Sigue oculto para el club/monitor: lo mostramos solo para este alumno.
      await upsertOverride(objectiveId, "student", ctx, userId, {
        hidden: false,
      });
    }
  }
  const stillHidden =
    scope === "student" && ctx.studentId
      ? false
      : await isHiddenForStudent(objectiveId, ctx);
  return { ok: true, stillHidden };
}

async function isHiddenForStudent(objectiveId: string, ctx: ScopeContext) {
  if (!ctx.studentId) return false;
  const [row] = await db
    .select({ hidden: objectiveOverrides.hidden })
    .from(objectiveOverrides)
    .where(
      and(
        eq(objectiveOverrides.objectiveId, objectiveId),
        eq(objectiveOverrides.studentId, ctx.studentId)
      )
    )
    .limit(1);
  return row?.hidden === true;
}

/**
 * Sube o baja un objetivo dentro de su grupo. `items` es el catálogo efectivo
 * del mismo contexto (con ocultos). Lo propio del ámbito se reordena en la
 * propia fila; lo demás, con un ajuste de orden para este ámbito.
 */
export async function moveObjectiveFor(
  ctx: ScopeContext,
  scope: WriteScope,
  userId: string,
  items: ObjectiveItem[],
  objectiveId: string,
  direction: "up" | "down"
): Promise<WriteOk | WriteFailure> {
  const changes = planMove(items, objectiveId, direction);
  if (!changes) return { ok: true }; // ya está en el extremo: nada que hacer
  const byId = new Map(items.map((i) => [i.id, i]));

  for (const change of changes) {
    const item = byId.get(change.id);
    if (!item || !allowedFor(item.scope, scope))
      return { ok: false, error: "Not found" };
    if (item.scope === scope) {
      await db
        .update(tennisObjectives)
        .set({ sortOrder: change.sortOrder })
        .where(eq(tennisObjectives.id, change.id));
    } else {
      await upsertOverride(change.id, scope, ctx, userId, {
        sortOrder: change.sortOrder,
      });
    }
  }
  return { ok: true };
}
