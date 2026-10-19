import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { studentObjectives, tennisObjectives } from "@/db/schema";
import type { AspectId, BallId, ObjectiveItem } from "./objectives-taxonomy";

export * from "./objectives-taxonomy";

/** Todos los objetivos activos (de todas las bolas) con el estado del alumno. */
export async function loadStudentObjectives(
  studentId: string
): Promise<ObjectiveItem[]> {
  const [catalog, marks] = await Promise.all([
    db
      .select()
      .from(tennisObjectives)
      .where(
        and(
          eq(tennisObjectives.sport, "tenis"),
          eq(tennisObjectives.isActive, true)
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

  const done = new Map(marks.map((m) => [m.objectiveId, m.achievedAt]));
  return catalog.map((o) => ({
    id: o.id,
    code: o.code,
    ball: o.ball as BallId,
    aspect: o.aspect as AspectId,
    block: o.block,
    title: o.title,
    criterion: o.criterion,
    source: o.source,
    sortOrder: o.sortOrder,
    achieved: done.has(o.id),
    achievedAt: done.get(o.id)?.toISOString() ?? null,
  }));
}
