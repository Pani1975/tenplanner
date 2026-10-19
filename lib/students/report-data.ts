import { and, asc, eq, gte, lt, lte, ne } from "drizzle-orm";
import { db } from "@/db";
import { sessionStudents, sessions, students } from "@/db/schema";
import {
  loadStudentObjectives,
  summarizeObjectivesByLevel,
  type LevelSummary,
} from "@/lib/objectives";
import { loadStudentTrainingStatsInRange } from "@/lib/stats/load-training-stats";
import type { TrainingStats } from "@/lib/stats/training-stats";

export type ReportSession = {
  scheduledAt: Date;
  title: string;
  durationMinutes: number;
  objective: string | null;
  /** true = asistió, false = faltó, null = sin registrar. */
  attended: boolean | null;
  feedback: string | null;
};

export type StudentReport = {
  student: {
    name: string;
    birthDate: string | null;
    notes: string | null;
  };
  from: Date;
  to: Date;
  summary: {
    held: number;
    attended: number;
    absent: number;
    unrecorded: number;
    minutes: number;
    /** 0-100, null si no hay asistencia registrada. */
    attendanceRate: number | null;
  };
  sessions: ReportSession[];
  stats: TrainingStats;
  levels: LevelSummary[];
  achievedInPeriod: number;
};

/** Principio del día `from` y final del día `to` (fechas "YYYY-MM-DD", UTC). */
export function periodBounds(from: string, to: string) {
  return {
    from: new Date(`${from}T00:00:00.000Z`),
    to: new Date(`${to}T23:59:59.999Z`),
  };
}

/** Datos del informe de un alumno para un periodo. El acceso se comprueba fuera. */
export async function loadStudentReport(
  studentId: string,
  range: { from: Date; to: Date }
): Promise<StudentReport | null> {
  const [student] = await db
    .select({
      name: students.name,
      birthDate: students.birthDate,
      notes: students.notes,
    })
    .from(students)
    .where(eq(students.id, studentId))
    .limit(1);
  if (!student) return null;

  const [rows, stats, objectives] = await Promise.all([
    db
      .select({
        scheduledAt: sessions.scheduledAt,
        title: sessions.title,
        durationMinutes: sessions.durationMinutes,
        objective: sessions.objective,
        attended: sessionStudents.attended,
        feedback: sessionStudents.feedback,
      })
      .from(sessionStudents)
      .innerJoin(sessions, eq(sessions.id, sessionStudents.sessionId))
      .where(
        and(
          eq(sessionStudents.studentId, studentId),
          gte(sessions.scheduledAt, range.from),
          lte(sessions.scheduledAt, range.to),
          lt(sessions.scheduledAt, new Date()),
          ne(sessions.status, "cancelled")
        )
      )
      .orderBy(asc(sessions.scheduledAt)),
    loadStudentTrainingStatsInRange(studentId, range.from, range.to),
    loadStudentObjectives(studentId).catch((error) => {
      console.error("[student-report] objectives failed", error);
      return [];
    }),
  ]);

  const attended = rows.filter((r) => r.attended === true).length;
  const absent = rows.filter((r) => r.attended === false).length;
  const recorded = attended + absent;
  const minutes = rows
    .filter((r) => r.attended !== false)
    .reduce((acc, r) => acc + r.durationMinutes, 0);

  const levels = summarizeObjectivesByLevel(objectives, range);

  return {
    student,
    from: range.from,
    to: range.to,
    summary: {
      held: rows.length,
      attended,
      absent,
      unrecorded: rows.length - recorded,
      minutes,
      attendanceRate:
        recorded > 0 ? Math.round((attended / recorded) * 100) : null,
    },
    sessions: rows,
    stats,
    levels,
    achievedInPeriod: levels.reduce((acc, l) => acc + l.newInPeriod, 0),
  };
}
