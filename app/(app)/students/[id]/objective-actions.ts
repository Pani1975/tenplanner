"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { objectiveOverrides, students, tennisObjectives } from "@/db/schema";
import {
  canTagWithClub,
  getActiveWorkClubId,
  sharedWithClubCondition,
} from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";
import {
  BALLS,
  objectiveScopeFor,
  type ObjectiveScope,
  type StudentScopeContext,
} from "@/lib/objectives";

// Personalización de objetivos. Un cambio puede aplicarse a:
//  - "student": solo a este alumno;
//  - "club": a todos los alumnos del club del alumno (cualquier miembro activo);
//  - "coach": a todos los alumnos particulares (sin club) del monitor.
type EditScope = Exclude<ObjectiveScope, "base">;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const scopeSchema = z.enum(["student", "club", "coach"]);
const baseIds = {
  studentId: z.string().regex(UUID_RE),
  scope: scopeSchema,
};
const textFields = {
  title: z.string().trim().min(1).max(200),
  criterion: z.string().trim().max(300).optional(),
};

type Failure = { ok: false; error: string };
type Authorized = {
  ok: true;
  userId: string;
  ctx: StudentScopeContext;
};

/** Usuario autenticado + permiso para editar en `scope` los objetivos de este alumno. */
async function authorize(
  studentId: string,
  scope: EditScope
): Promise<Authorized | Failure> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return { ok: false, error: "Unauthorized" };

  const activeClubId = await getActiveWorkClubId(user.id);
  const [student] = await db
    .select({ coachId: students.coachId, clubId: students.clubId })
    .from(students)
    .where(
      and(
        eq(students.id, studentId),
        sharedWithClubCondition(
          students.coachId,
          students.clubId,
          user.id,
          activeClubId
        )
      )
    )
    .limit(1);
  if (!student) return { ok: false, error: "Forbidden" };

  if (scope === "club") {
    if (!student.clubId || !(await canTagWithClub(user.id, student.clubId)))
      return { ok: false, error: "Forbidden" };
  } else if (scope === "coach") {
    if (student.clubId || student.coachId !== user.id)
      return { ok: false, error: "Forbidden" };
  }

  return {
    ok: true,
    userId: user.id,
    ctx: { studentId, clubId: student.clubId, coachId: student.coachId },
  };
}

/** Columnas de ámbito (club_id / coach_id / student_id) para `scope`. */
function scopeColumns(scope: EditScope, ctx: StudentScopeContext) {
  return {
    clubId: scope === "club" ? ctx.clubId : null,
    coachId: scope === "coach" ? ctx.coachId : null,
    studentId: scope === "student" ? ctx.studentId : null,
  };
}

function overrideWhere(
  objectiveId: string,
  scope: EditScope,
  ctx: StudentScopeContext
) {
  const col =
    scope === "club"
      ? eq(objectiveOverrides.clubId, ctx.clubId!)
      : scope === "coach"
        ? eq(objectiveOverrides.coachId, ctx.coachId)
        : eq(objectiveOverrides.studentId, ctx.studentId);
  return and(eq(objectiveOverrides.objectiveId, objectiveId), col)!;
}

/** Objetivo activo que además le corresponde a este alumno. */
async function loadVisibleObjective(
  objectiveId: string,
  ctx: StudentScopeContext
) {
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

/** Un objetivo propio de un alumno no se puede ajustar para todo el club/monitor. */
function scopeAllowed(ownScope: ObjectiveScope, scope: EditScope) {
  return ownScope !== "student" || scope === "student";
}

type OverridePatch = {
  hidden?: boolean | null;
  title?: string | null;
  criterion?: string | null;
};

async function upsertOverride(
  objectiveId: string,
  scope: EditScope,
  ctx: StudentScopeContext,
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

function refresh(studentId: string, scope: EditScope) {
  // Un cambio de club o de monitor afecta a las fichas de varios alumnos.
  if (scope === "student") revalidatePath(`/students/${studentId}`);
  else revalidatePath("/students", "layout");
}

/** Crea un objetivo propio en el ámbito elegido. */
export async function createObjective(input: {
  studentId: string;
  scope: EditScope;
  ball: string;
  aspect: string;
  block: string;
  title: string;
  criterion?: string;
}) {
  const parsed = z
    .object({
      ...baseIds,
      ...textFields,
      ball: z.enum(BALLS.map((b) => b.id) as [string, ...string[]]),
      aspect: z.enum(["tecnico", "tactico", "mental", "fisico"]),
      block: z.string().trim().min(1).max(80),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.studentId, v.scope);
  if (!auth.ok) return auth;

  const ball = BALLS.find((b) => b.id === v.ball)!;
  const [last] = await db
    .select({ sortOrder: tennisObjectives.sortOrder })
    .from(tennisObjectives)
    .where(eq(tennisObjectives.ball, v.ball))
    .orderBy(desc(tennisObjectives.sortOrder))
    .limit(1);

  const [row] = await db
    .insert(tennisObjectives)
    .values({
      code: `CU-${randomBytes(5).toString("hex").toUpperCase()}`,
      ball: v.ball,
      stage: ball.stage,
      ageRange: ball.age,
      aspect: v.aspect,
      block: v.block,
      title: v.title,
      criterion: v.criterion || null,
      source: "propio",
      sortOrder: (last?.sortOrder ?? 0) + 1,
      createdBy: auth.userId,
      ...scopeColumns(v.scope, auth.ctx),
    })
    .returning({ id: tennisObjectives.id });

  refresh(v.studentId, v.scope);
  return { ok: true as const, id: row.id };
}

/**
 * Edita título y criterio. Un objetivo creado en este mismo ámbito se modifica
 * directamente; cualquier otro (base o de otro ámbito) recibe un ajuste que
 * solo aplica a este ámbito y no toca el original.
 */
export async function updateObjective(input: {
  studentId: string;
  scope: EditScope;
  objectiveId: string;
  title: string;
  criterion?: string;
}) {
  const parsed = z
    .object({
      ...baseIds,
      ...textFields,
      objectiveId: z.string().regex(UUID_RE),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.studentId, v.scope);
  if (!auth.ok) return auth;
  const found = await loadVisibleObjective(v.objectiveId, auth.ctx);
  if (!found || !scopeAllowed(found.ownScope, v.scope))
    return { ok: false as const, error: "Not found" };

  const criterion = v.criterion ?? "";
  if (found.ownScope === v.scope) {
    await db
      .update(tennisObjectives)
      .set({ title: v.title, criterion: criterion || null })
      .where(eq(tennisObjectives.id, v.objectiveId));
  } else {
    const o = found.objective;
    await upsertOverride(v.objectiveId, v.scope, auth.ctx, auth.userId, {
      title: v.title === o.title ? null : v.title,
      criterion: criterion === (o.criterion ?? "") ? null : criterion,
    });
  }

  refresh(v.studentId, v.scope);
  return { ok: true as const };
}

/**
 * Quita un objetivo en el ámbito elegido. Uno creado en ese mismo ámbito se
 * desactiva (las marcas de los alumnos se conservan); cualquier otro se oculta.
 */
export async function removeObjective(input: {
  studentId: string;
  scope: EditScope;
  objectiveId: string;
}) {
  const parsed = z
    .object({ ...baseIds, objectiveId: z.string().regex(UUID_RE) })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.studentId, v.scope);
  if (!auth.ok) return auth;
  const found = await loadVisibleObjective(v.objectiveId, auth.ctx);
  if (!found || !scopeAllowed(found.ownScope, v.scope))
    return { ok: false as const, error: "Not found" };

  if (found.ownScope === v.scope) {
    await db
      .update(tennisObjectives)
      .set({ isActive: false })
      .where(eq(tennisObjectives.id, v.objectiveId));
  } else {
    await upsertOverride(v.objectiveId, v.scope, auth.ctx, auth.userId, {
      hidden: true,
    });
  }

  refresh(v.studentId, v.scope);
  return { ok: true as const };
}

/**
 * Restaura el objetivo original en el ámbito elegido (borra su ajuste). Si
 * al hacerlo sigue oculto por un ajuste de otro ámbito y el cambio es para el
 * alumno, se vuelve a mostrar solo para él.
 */
export async function restoreObjective(input: {
  studentId: string;
  scope: EditScope;
  objectiveId: string;
}) {
  const parsed = z
    .object({ ...baseIds, objectiveId: z.string().regex(UUID_RE) })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.studentId, v.scope);
  if (!auth.ok) return auth;
  const found = await loadVisibleObjective(v.objectiveId, auth.ctx);
  if (!found || !scopeAllowed(found.ownScope, v.scope))
    return { ok: false as const, error: "Not found" };

  await db
    .delete(objectiveOverrides)
    .where(overrideWhere(v.objectiveId, v.scope, auth.ctx));

  // ¿Sigue oculto por otro ámbito? Si estamos en el alumno, lo mostramos para él.
  let stillHidden = false;
  if (v.scope === "student") {
    const wider = await db
      .select({ hidden: objectiveOverrides.hidden })
      .from(objectiveOverrides)
      .where(
        and(
          eq(objectiveOverrides.objectiveId, v.objectiveId),
          auth.ctx.clubId
            ? eq(objectiveOverrides.clubId, auth.ctx.clubId)
            : eq(objectiveOverrides.coachId, auth.ctx.coachId)
        )
      )
      .limit(1);
    if (wider[0]?.hidden) {
      await upsertOverride(v.objectiveId, "student", auth.ctx, auth.userId, {
        hidden: false,
      });
    }
  } else {
    const student = await db
      .select({ hidden: objectiveOverrides.hidden })
      .from(objectiveOverrides)
      .where(
        and(
          eq(objectiveOverrides.objectiveId, v.objectiveId),
          eq(objectiveOverrides.studentId, v.studentId)
        )
      )
      .limit(1);
    stillHidden = student[0]?.hidden === true;
  }

  refresh(v.studentId, v.scope);
  return { ok: true as const, stillHidden };
}
