import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  groupStudents,
  groups,
  sessionStudents,
  sessions,
  students,
  users,
} from "@/db/schema";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { buildGroupReport, type GroupReport } from "@/lib/groups/report";
import {
  loadGroupTrainingStats,
  type StudentHours,
} from "@/lib/stats/load-training-stats";
import type { TrainingStats } from "@/lib/stats/training-stats";

export type GroupReportData = {
  groupName: string;
  coachName: string;
  generatedAt: Date;
  report: GroupReport;
  /** Fases, aspectos, tipos de juego, golpes y ejercicios más repetidos. */
  training: TrainingStats;
  /** Horas de cada alumno en las sesiones del grupo. */
  studentHours: StudentHours[];
};

/**
 * Carga el grupo y calcula su informe para el usuario indicado. Devuelve
 * null si el grupo no existe o no es visible para ese usuario (mismas reglas
 * que la ficha del grupo).
 */
export async function loadGroupReportData(
  groupId: string,
  userId: string,
  now = new Date()
): Promise<GroupReportData | null> {
  const activeClubId = await getActiveWorkClubId(userId);

  const [group] = await db
    .select({
      id: groups.id,
      name: groups.name,
      coachId: groups.coachId,
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

  if (!group) return null;

  const [coach] = await db
    .select({ name: users.name, email: users.email })
    .from(users)
    .where(eq(users.id, group.coachId))
    .limit(1);

  const members = await db
    .select({
      id: students.id,
      name: students.name,
      playerLevel: students.playerLevel,
    })
    .from(groupStudents)
    .innerJoin(students, eq(groupStudents.studentId, students.id))
    .where(eq(groupStudents.groupId, groupId))
    .orderBy(students.name);

  const groupSessions = await db
    .select({
      id: sessions.id,
      title: sessions.title,
      scheduledAt: sessions.scheduledAt,
      durationMinutes: sessions.durationMinutes,
      status: sessions.status,
      intensity: sessions.intensity,
    })
    .from(sessions)
    .where(eq(sessions.groupId, groupId));

  const records =
    groupSessions.length === 0
      ? []
      : await db
          .select({
            sessionId: sessionStudents.sessionId,
            studentId: sessionStudents.studentId,
            attended: sessionStudents.attended,
            rating: sessionStudents.rating,
          })
          .from(sessionStudents)
          .where(
            inArray(
              sessionStudents.sessionId,
              groupSessions.map((s) => s.id)
            )
          );

  const { stats: training, studentHours } = await loadGroupTrainingStats(
    groupId
  );

  return {
    groupName: group.name,
    coachName: coach?.name ?? coach?.email ?? "Entrenador",
    generatedAt: now,
    report: buildGroupReport({
      sessions: groupSessions,
      records,
      members,
      now,
    }),
    training,
    studentHours,
  };
}
