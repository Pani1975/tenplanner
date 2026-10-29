import {
  and,
  asc,
  eq,
  gte,
  inArray,
  isNull,
  lt,
  lte,
  ne,
  or,
} from "drizzle-orm";
import { db } from "@/db";
import {
  exercises,
  sessionBlockItems,
  sessionBlocks,
  sessions,
  sessionStudents,
  students,
} from "@/db/schema";
import type { StationItemJson } from "@/lib/block-items";
import {
  computeTrainingStats,
  type StatExerciseInfo,
  type StatSession,
  type TrainingStats,
} from "./training-stats";

// Sesiones que cuentan: ya pasadas y no canceladas.
function pastNotCancelled() {
  return and(
    lt(sessions.scheduledAt, new Date()),
    ne(sessions.status, "cancelled")
  );
}

async function statsForSessionIds(ids: string[]): Promise<TrainingStats> {
  if (ids.length === 0) return computeTrainingStats([], new Map());

  const [sessionRows, itemRows] = await Promise.all([
    db
      .select({ id: sessions.id, durationMinutes: sessions.durationMinutes })
      .from(sessions)
      .where(inArray(sessions.id, ids)),
    db
      .select({
        sessionId: sessionBlocks.sessionId,
        blockId: sessionBlocks.id,
        blockOrder: sessionBlocks.orderIndex,
        itemId: sessionBlockItems.id,
        kind: sessionBlockItems.kind,
        exerciseId: sessionBlockItems.exerciseId,
        exerciseName: sessionBlockItems.exerciseName,
        title: sessionBlockItems.title,
        freeText: sessionBlockItems.freeText,
        durationMinutes: sessionBlockItems.durationMinutes,
        aspectoJuego: sessionBlockItems.aspectoJuego,
        stations: sessionBlockItems.stations,
      })
      .from(sessionBlocks)
      .leftJoin(
        sessionBlockItems,
        eq(sessionBlockItems.blockId, sessionBlocks.id)
      )
      .where(inArray(sessionBlocks.sessionId, ids))
      .orderBy(
        asc(sessionBlocks.orderIndex),
        asc(sessionBlockItems.orderIndex)
      ),
  ]);

  const exerciseIds = new Set<string>();
  for (const r of itemRows) {
    if (r.exerciseId) exerciseIds.add(r.exerciseId);
    for (const st of (r.stations as StationItemJson[] | null) ?? []) {
      if (st.exerciseId) exerciseIds.add(st.exerciseId);
    }
  }
  const exerciseRows = exerciseIds.size
    ? await db
        .select({
          id: exercises.id,
          name: exercises.name,
          category: exercises.category,
          durationMinutes: exercises.durationMinutes,
          aspectos: exercises.aspectosJuego,
          aspecto: exercises.aspectoJuego,
          tipos: exercises.tiposActividad,
          golpes: exercises.golpes,
        })
        .from(exercises)
        .where(inArray(exercises.id, Array.from(exerciseIds)))
    : [];
  const info = new Map<string, StatExerciseInfo>(
    exerciseRows.map((e) => [
      e.id,
      {
        name: e.name,
        category: e.category,
        durationMinutes: e.durationMinutes,
        aspectos: Array.isArray(e.aspectos) ? (e.aspectos as string[]) : null,
        aspecto: e.aspecto,
        tipos: Array.isArray(e.tipos) ? (e.tipos as string[]) : null,
        golpes: Array.isArray(e.golpes) ? (e.golpes as string[]) : null,
      },
    ])
  );

  const bySession = new Map<string, StatSession>(
    sessionRows.map((s) => [
      s.id,
      { id: s.id, durationMinutes: s.durationMinutes, blocks: [] },
    ])
  );
  const blocks = new Map<string, StatSession["blocks"][number]>();
  for (const r of itemRows) {
    const session = bySession.get(r.sessionId);
    if (!session) continue;
    let block = blocks.get(r.blockId);
    if (!block) {
      block = { orderIndex: r.blockOrder, items: [] };
      blocks.set(r.blockId, block);
      session.blocks.push(block);
    }
    if (r.itemId) {
      block.items.push({
        kind: r.kind,
        exerciseId: r.exerciseId,
        exerciseName: r.exerciseName,
        title: r.title,
        freeText: r.freeText,
        durationMinutes: r.durationMinutes,
        aspectoJuego: r.aspectoJuego,
        stations: (r.stations as StationItemJson[] | null) ?? null,
      });
    }
  }

  return computeTrainingStats(Array.from(bySession.values()), info);
}

export interface StudentHours {
  id: string;
  name: string;
  minutes: number;
  sessions: number;
}

/** Estadística del grupo y horas de cada alumno en las sesiones del grupo. */
export async function loadGroupTrainingStats(groupId: string): Promise<{
  stats: TrainingStats;
  studentHours: StudentHours[];
}> {
  const rows = await db
    .select({ id: sessions.id, durationMinutes: sessions.durationMinutes })
    .from(sessions)
    .where(and(eq(sessions.groupId, groupId), pastNotCancelled()));
  const ids = rows.map((r) => r.id);
  const [stats, attendance] = await Promise.all([
    statsForSessionIds(ids),
    ids.length
      ? db
          .select({
            studentId: sessionStudents.studentId,
            name: students.name,
            minutes: sessions.durationMinutes,
          })
          .from(sessionStudents)
          .innerJoin(sessions, eq(sessions.id, sessionStudents.sessionId))
          .innerJoin(students, eq(students.id, sessionStudents.studentId))
          .where(
            and(
              inArray(sessionStudents.sessionId, ids),
              // Si se pasó lista y faltó, no cuenta.
              or(
                isNull(sessionStudents.attended),
                eq(sessionStudents.attended, true)
              )
            )
          )
      : Promise.resolve([]),
  ]);

  const hours = new Map<string, StudentHours>();
  for (const a of attendance) {
    const h = hours.get(a.studentId) ?? {
      id: a.studentId,
      name: a.name,
      minutes: 0,
      sessions: 0,
    };
    h.minutes += a.minutes;
    h.sessions += 1;
    hours.set(a.studentId, h);
  }
  return {
    stats,
    studentHours: Array.from(hours.values()).sort(
      (a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name)
    ),
  };
}

/** Estadística de un alumno: sesiones pasadas a las que no faltó. */
export async function loadStudentTrainingStats(
  studentId: string
): Promise<TrainingStats> {
  const rows = await db
    .select({ id: sessions.id })
    .from(sessionStudents)
    .innerJoin(sessions, eq(sessions.id, sessionStudents.sessionId))
    .where(
      and(
        eq(sessionStudents.studentId, studentId),
        pastNotCancelled(),
        or(isNull(sessionStudents.attended), eq(sessionStudents.attended, true))
      )
    );
  return statsForSessionIds(rows.map((r) => r.id));
}

/**
 * Estadística de un alumno limitada a un periodo (sesiones pasadas, no
 * canceladas y a las que no faltó, dentro de [from, to]).
 */
export async function loadStudentTrainingStatsInRange(
  studentId: string,
  from: Date,
  to: Date
): Promise<TrainingStats> {
  const rows = await db
    .select({ id: sessions.id })
    .from(sessionStudents)
    .innerJoin(sessions, eq(sessions.id, sessionStudents.sessionId))
    .where(
      and(
        eq(sessionStudents.studentId, studentId),
        pastNotCancelled(),
        gte(sessions.scheduledAt, from),
        lte(sessions.scheduledAt, to),
        or(isNull(sessionStudents.attended), eq(sessionStudents.attended, true))
      )
    );
  return statsForSessionIds(rows.map((r) => r.id));
}
