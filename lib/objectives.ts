import { and, asc, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  objectiveOverrides,
  studentObjectives,
  students,
  tennisObjectives,
} from "@/db/schema";
import type { ObjectiveItem } from "./objectives-taxonomy";
import {
  resolveObjectives,
  type StudentScopeContext,
} from "./objectives-resolve";

export * from "./objectives-taxonomy";
export * from "./objectives-resolve";

/** Condición SQL de los objetivos que pueden aplicarse a un alumno (base + propios). */
function objectiveScopeCondition(ctx: StudentScopeContext): SQL {
  const parts: SQL[] = [
    and(
      isNull(tennisObjectives.clubId),
      isNull(tennisObjectives.coachId),
      isNull(tennisObjectives.studentId)
    )!,
    eq(tennisObjectives.studentId, ctx.studentId),
  ];
  if (ctx.clubId) parts.push(eq(tennisObjectives.clubId, ctx.clubId));
  else parts.push(eq(tennisObjectives.coachId, ctx.coachId));
  return or(...parts)!;
}

/** Contexto de ámbito de un alumno (club y monitor), o null si no existe. */
export async function loadStudentScopeContext(
  studentId: string
): Promise<StudentScopeContext | null> {
  const [row] = await db
    .select({ clubId: students.clubId, coachId: students.coachId })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  return row ? { studentId, clubId: row.clubId, coachId: row.coachId } : null;
}

/**
 * Objetivos efectivos de un alumno: catálogo base + objetivos propios de su
 * club, monitor o del propio alumno, con los ajustes aplicados. Por defecto
 * excluye los ocultos; `includeHidden` los devuelve (para poder restaurarlos).
 */
export async function loadStudentObjectives(
  studentId: string,
  opts: { includeHidden?: boolean } = {}
): Promise<ObjectiveItem[]> {
  const ctx = await loadStudentScopeContext(studentId);
  if (!ctx) return [];

  const [catalog, marks] = await Promise.all([
    db
      .select()
      .from(tennisObjectives)
      .where(
        and(
          eq(tennisObjectives.sport, "tenis"),
          eq(tennisObjectives.isActive, true),
          objectiveScopeCondition(ctx)
        )
      )
      .orderBy(asc(tennisObjectives.ball), asc(tennisObjectives.sortOrder)),
    db
      .select({
        objectiveId: studentObjectives.objectiveId,
        achievedAt: studentObjectives.achievedAt,
      })
      .from(studentObjectives)
      .where(
        and(
          eq(studentObjectives.studentId, studentId),
          eq(studentObjectives.achieved, true)
        )
      ),
  ]);

  const ids = catalog.map((o) => o.id);
  const overrides = ids.length
    ? await db
        .select()
        .from(objectiveOverrides)
        .where(
          and(
            inArray(objectiveOverrides.objectiveId, ids),
            or(
              eq(objectiveOverrides.studentId, studentId),
              ctx.clubId
                ? eq(objectiveOverrides.clubId, ctx.clubId)
                : eq(objectiveOverrides.coachId, ctx.coachId)
            )
          )
        )
    : [];

  const items = resolveObjectives(
    catalog,
    overrides,
    new Map(marks.map((m) => [m.objectiveId, m.achievedAt])),
    ctx
  );
  return opts.includeHidden ? items : items.filter((i) => !i.hidden);
}
