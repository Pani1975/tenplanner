import { and, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { clubMembers, exercises } from "@/db/schema";

/**
 * Ejercicios del propio usuario más los de cualquier club del que sea
 * miembro activo (creados por él o por otro monitor trabajando como ese
 * club). Es la condición de *acceso* (poder usarlo en una clase o sesión,
 * abrir su ficha); el listado "Mis ejercicios" se filtra además por el
 * espacio activo con sharedWithClubCondition (ver lib/clubs.ts).
 */
export function exerciseOwnOrClubCondition(userId: string): SQL {
  return or(
    eq(exercises.createdBy, userId),
    sql`${exercises.clubId} in (select ${clubMembers.clubId} from ${clubMembers} where ${clubMembers.userId} = ${userId} and ${clubMembers.status} = 'active')`
  )!;
}

export function exerciseVisibleToUserCondition(
  userId: string | null | undefined
): SQL {
  const publicExercise = or(
    eq(exercises.isGlobal, true),
    isNull(exercises.createdBy)
  );

  if (!userId) return publicExercise!;

  return or(publicExercise!, exerciseOwnOrClubCondition(userId))!;
}

/** Igual que exerciseVisibleToUserCondition, para un ejercicio ya cargado. */
export async function canAccessExercise(
  exercise: {
    isGlobal: boolean;
    createdBy: string | null;
    clubId: string | null;
  },
  userId: string | null | undefined
): Promise<boolean> {
  if (exercise.isGlobal || exercise.createdBy === null) return true;
  if (!userId) return false;
  if (exercise.createdBy === userId) return true;
  if (!exercise.clubId) return false;
  const [row] = await db
    .select({ id: clubMembers.id })
    .from(clubMembers)
    .where(
      and(
        eq(clubMembers.clubId, exercise.clubId),
        eq(clubMembers.userId, userId),
        eq(clubMembers.status, "active")
      )
    )
    .limit(1);
  return !!row;
}

export async function getAccessibleExerciseDurationMap(
  userId: string | null | undefined,
  exerciseIds: string[]
): Promise<{
  durationById: Map<string, number>;
  inaccessibleIds: string[];
}> {
  const uniqueIds = Array.from(new Set(exerciseIds));
  if (uniqueIds.length === 0) {
    return { durationById: new Map(), inaccessibleIds: [] };
  }

  const rows = await db
    .select({ id: exercises.id, durationMinutes: exercises.durationMinutes })
    .from(exercises)
    .where(
      and(
        inArray(exercises.id, uniqueIds),
        exerciseVisibleToUserCondition(userId)
      )
    );

  const durationById = new Map(
    rows.map((row) => [row.id, row.durationMinutes])
  );
  const inaccessibleIds = uniqueIds.filter((id) => !durationById.has(id));

  return { durationById, inaccessibleIds };
}

export function calculateExercisePlanDuration(
  exerciseItems: { exerciseId: string; durationMinutes?: number | null }[],
  durationById: Map<string, number>
): number {
  return exerciseItems.reduce((sum, item) => {
    const duration =
      item.durationMinutes ?? durationById.get(item.exerciseId) ?? 0;
    return sum + duration;
  }, 0);
}
