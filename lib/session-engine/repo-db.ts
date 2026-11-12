// Acceso a datos del motor: carga en pocas consultas todo lo que
// generateSession necesita. El motor en sí no toca la base.

import { and, asc, avg, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { normalizeSearchText } from "@/lib/exercises/search-text";
import {
  exerciseRatings,
  exercises,
  groupStudents,
  groups,
  sessionBlockItems,
  sessionBlocks,
  sessionExercises,
  sessions,
  students,
} from "@/db/schema";
import { sharedWithClubCondition } from "@/lib/clubs";
import { exerciseVisibleToUserCondition } from "@/lib/exercise-access";
import { loadSkillLevels } from "@/lib/skill-levels-repo";
import type { GroupScheduleEntry } from "@/lib/groups/schedule";
import {
  GOLPES,
  type EngineData,
  type EngineExercise,
  type Golpe,
} from "./types";

export type EngineGroup = {
  id: string;
  name: string;
  sport: string;
  clubId: string | null;
  coachId: string;
  defaultLevel: string | null;
  weeklySchedule: GroupScheduleEntry[] | null;
  students: { id: string; name: string; playerLevel: string | null }[];
};

/** Grupo accesible para el usuario en su espacio activo, con sus alumnos. */
export async function loadEngineGroup(
  userId: string,
  activeClubId: string | null,
  groupId: string
): Promise<EngineGroup | null> {
  const [g] = await db
    .select({
      id: groups.id,
      name: groups.name,
      sport: groups.sport,
      clubId: groups.clubId,
      coachId: groups.coachId,
      defaultLevel: groups.defaultLevel,
      weeklySchedule: groups.weeklySchedule,
    })
    .from(groups)
    .where(
      and(
        eq(groups.id, groupId),
        sharedWithClubCondition(
          groups.coachId,
          groups.clubId,
          userId,
          activeClubId
        )
      )
    )
    .limit(1);
  if (!g) return null;
  const members = await db
    .select({
      id: students.id,
      name: students.name,
      playerLevel: students.playerLevel,
    })
    .from(groupStudents)
    .innerJoin(students, eq(groupStudents.studentId, students.id))
    .where(eq(groupStudents.groupId, groupId))
    .orderBy(asc(students.name));
  return { ...g, students: members };
}

/** Ejercicios del deporte que el usuario puede usar, ya resumidos. */
export async function loadEnginePool(
  userId: string,
  sport: string
): Promise<EngineExercise[]> {
  const rows = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      durationMinutes: exercises.durationMinutes,
      fases: exercises.fases,
      phase: exercises.phase,
      niveles: exercises.niveles,
      golpes: exercises.golpes,
      caracter: exercises.caracter,
      aspectos: exercises.aspectosJuego,
      parametros: exercises.parametros,
      situaciones: exercises.situacionJuego,
      objectivesText: exercises.objectives,
      tipoActividad: exercises.tipoActividad,
      tipoPelota: exercises.tipoPelota,
      numJugadores: exercises.numJugadores,
      hasSteps: sql<boolean>`coalesce(json_typeof(${exercises.steps}) = 'array' and json_array_length(${exercises.steps}) > 0, false)`,
      hasVariantes: sql<boolean>`coalesce(length(trim(${exercises.variantes})) > 0, false)`,
      hasMedia: sql<boolean>`(${exercises.imageUrl} is not null or ${exercises.animationScene} is not null or coalesce(json_typeof(${exercises.imageUrls}) = 'array' and json_array_length(${exercises.imageUrls}) > 0, false))`,
    })
    .from(exercises)
    .where(
      and(
        eq(exercises.sport, sport as "tenis"),
        exerciseVisibleToUserCondition(userId)
      )
    );

  const ratings = await db
    .select({
      id: exerciseRatings.exerciseId,
      avg: avg(exerciseRatings.rating),
    })
    .from(exerciseRatings)
    .groupBy(exerciseRatings.exerciseId);
  const ratingById = new Map(
    ratings.map((r) => [r.id, r.avg === null ? null : Number(r.avg)])
  );

  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];

  return rows.map((r) => {
    const fases = arr(r.fases);
    return {
      id: r.id,
      name: r.name,
      durationMinutes: r.durationMinutes,
      fases: fases.length > 0 ? fases : r.phase ? [r.phase] : [],
      niveles: arr(r.niveles),
      golpes: arr(r.golpes),
      caracter: arr(r.caracter),
      aspectos: arr(r.aspectos),
      tipoActividad: r.tipoActividad ?? null,
      tipoPelota: r.tipoPelota ?? null,
      numJugadores: r.numJugadores ?? null,
      hasSteps: !!r.hasSteps,
      hasVariantes: !!r.hasVariantes,
      hasMedia: !!r.hasMedia,
      ratingAvg: ratingById.get(r.id) ?? null,
      parametros: arr(r.parametros),
      situaciones: arr(r.situaciones),
      text: normalizeSearchText(`${r.name} ${r.objectivesText ?? ""}`),
    };
  });
}

/** Ejercicios de las últimas sesiones completadas del grupo (más reciente primero). */
export async function loadRecentGroupSessions(
  groupId: string,
  limit = 8
): Promise<string[][]> {
  const recent = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(and(eq(sessions.groupId, groupId), eq(sessions.status, "completed")))
    .orderBy(desc(sessions.scheduledAt))
    .limit(limit);
  if (recent.length === 0) return [];
  const ids = recent.map((r) => r.id);
  const [blockRows, legacyRows] = await Promise.all([
    db
      .select({
        sessionId: sessionBlocks.sessionId,
        exerciseId: sessionBlockItems.exerciseId,
      })
      .from(sessionBlockItems)
      .innerJoin(sessionBlocks, eq(sessionBlockItems.blockId, sessionBlocks.id))
      .where(
        and(
          inArray(sessionBlocks.sessionId, ids),
          isNotNull(sessionBlockItems.exerciseId)
        )
      ),
    db
      .select({
        sessionId: sessionExercises.sessionId,
        exerciseId: sessionExercises.exerciseId,
      })
      .from(sessionExercises)
      .where(inArray(sessionExercises.sessionId, ids)),
  ]);
  const bySession = new Map<string, Set<string>>(
    ids.map((id) => [id, new Set()])
  );
  for (const r of [...blockRows, ...legacyRows]) {
    if (r.exerciseId) bySession.get(r.sessionId)?.add(r.exerciseId);
  }
  return ids.map((id) => [...(bySession.get(id) ?? [])]);
}

/** Todo lo que el motor necesita para un grupo y unos asistentes. */
export async function loadEngineData(
  userId: string,
  group: EngineGroup,
  attendeeIds: string[]
): Promise<EngineData> {
  const [levels, pool, recentSessions] = await Promise.all([
    loadSkillLevels(),
    loadEnginePool(userId, group.sport),
    loadRecentGroupSessions(group.id),
  ]);
  const wanted = new Set(attendeeIds);
  const attendeeLevels = group.students
    .filter((s) => wanted.has(s.id))
    .map((s) => s.playerLevel);

  const golpesById = new Map(pool.map((e) => [e.id, e.golpes]));
  const recentGolpeCounts: Partial<Record<Golpe, number>> = {};
  for (const id of recentSessions.flat()) {
    for (const g of golpesById.get(id) ?? []) {
      if ((GOLPES as readonly string[]).includes(g)) {
        recentGolpeCounts[g as Golpe] =
          (recentGolpeCounts[g as Golpe] ?? 0) + 1;
      }
    }
  }

  return {
    sport: group.sport,
    levels,
    attendeeLevels,
    groupDefaultLevel: group.defaultLevel,
    exercises: pool,
    recentSessions,
    recentGolpeCounts,
  };
}
