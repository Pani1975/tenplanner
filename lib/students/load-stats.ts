import { and, eq, inArray, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { groupStudents, groups, students } from "@/db/schema";
import { sharedWithClubCondition } from "@/lib/clubs";
import { buildStudentsStats, type StudentsStats } from "@/lib/students/stats";

/**
 * Carga las estadísticas de la cartera de alumnos con las mismas reglas de
 * visibilidad que la lista de alumnos: los propios más los compartidos con el
 * club activo, y opcionalmente solo los de un monitor.
 */
export async function loadStudentsStats({
  userId,
  activeClubId,
  monitorFilter,
  now = new Date(),
}: {
  userId: string;
  activeClubId: string | null;
  monitorFilter: string | null;
  now?: Date;
}): Promise<StudentsStats> {
  const studentConditions: SQL[] = [
    sharedWithClubCondition(
      students.coachId,
      students.clubId,
      userId,
      activeClubId
    ),
    ...(monitorFilter ? [eq(students.coachId, monitorFilter)] : []),
  ];
  const groupConditions: SQL[] = [
    sharedWithClubCondition(
      groups.coachId,
      groups.clubId,
      userId,
      activeClubId
    ),
    ...(monitorFilter ? [eq(groups.coachId, monitorFilter)] : []),
  ];

  const [studentRows, groupRows] = await Promise.all([
    db
      .select({
        id: students.id,
        name: students.name,
        birthDate: students.birthDate,
        playerLevel: students.playerLevel,
        locality: students.locality,
        localityLat: students.localityLat,
        localityLng: students.localityLng,
      })
      .from(students)
      .where(and(...studentConditions)),
    db
      .select({ id: groups.id, name: groups.name })
      .from(groups)
      .where(and(...groupConditions)),
  ]);

  const memberships =
    groupRows.length === 0
      ? []
      : await db
          .select({
            groupId: groupStudents.groupId,
            studentId: groupStudents.studentId,
          })
          .from(groupStudents)
          .where(
            inArray(
              groupStudents.groupId,
              groupRows.map((g) => g.id)
            )
          );

  return buildStudentsStats({
    students: studentRows,
    groups: groupRows,
    memberships,
    now,
  });
}
