/**
 * Informe estadístico de un grupo de alumnos. Función pura: recibe las
 * sesiones del grupo, los registros de asistencia (session_students) y los
 * miembros, y devuelve las cifras ya calculadas. Así la página solo consulta
 * la base de datos y la lógica queda probada aparte.
 *
 * "Impartida" = sesión no cancelada y completada o con la fecha ya pasada
 * (mismo criterio que la planificación de la ficha del grupo).
 */

export interface GroupReportSession {
  id: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: "scheduled" | "completed" | "cancelled";
  intensity: number | null;
}

export interface GroupReportRecord {
  sessionId: string;
  studentId: string;
  attended: boolean | null;
  rating: number | null;
}

export interface GroupReportMember {
  id: string;
  name: string;
  playerLevel: string | null;
}

export interface GroupReportStudent {
  id: string;
  name: string;
  playerLevel: string | null;
  /** Sesiones impartidas con registro de asistencia para este alumno. */
  sessionsRecorded: number;
  attended: number;
  /** 0-100, null si no hay registros. */
  attendanceRate: number | null;
  /** Media 1-5, null si no hay valoraciones. */
  avgRating: number | null;
}

export interface GroupReport {
  taught: number;
  upcoming: number;
  hoursTaught: number;
  /** Sesiones impartidas sin ningún registro de asistencia. */
  unrecordedTaught: number;
  /** 0-100, null si no hay registros de asistencia. */
  attendanceRate: number | null;
  /** Media 1-5, null si no hay valoraciones. */
  avgRating: number | null;
  /** Media 1-5 de la intensidad de las sesiones impartidas. */
  avgIntensity: number | null;
  ratingsCount: number;
  lastTaughtAt: Date | null;
  nextAt: Date | null;
  levels: { level: string; count: number }[];
  students: GroupReportStudent[];
}

export const GROUP_LEVEL_LABEL: Record<string, string> = {
  beginner: "Principiante",
  amateur: "Aficionado",
  intermediate: "Intermedio",
  advanced: "Avanzado",
  competitive: "Competitivo",
};

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function percent(part: number, total: number): number | null {
  if (total === 0) return null;
  return Math.round((part / total) * 100);
}

export function buildGroupReport({
  sessions,
  records,
  members,
  now = new Date(),
}: {
  sessions: GroupReportSession[];
  records: GroupReportRecord[];
  members: GroupReportMember[];
  now?: Date;
}): GroupReport {
  const active = sessions.filter((s) => s.status !== "cancelled");
  const taughtList = active.filter(
    (s) => s.status === "completed" || s.scheduledAt < now
  );
  const upcomingList = active
    .filter((s) => s.status !== "completed" && s.scheduledAt >= now)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const taughtIds = new Set(taughtList.map((s) => s.id));

  const taughtRecords = records.filter((r) => taughtIds.has(r.sessionId));
  const recordedSessionIds = new Set(
    taughtRecords.filter((r) => r.attended !== null).map((r) => r.sessionId)
  );

  const attendedRecords = taughtRecords.filter((r) => r.attended !== null);
  const ratings = taughtRecords
    .map((r) => r.rating)
    .filter((v): v is number => v !== null);

  const students: GroupReportStudent[] = members.map((member) => {
    const mine = taughtRecords.filter(
      (r) => r.studentId === member.id && r.attended !== null
    );
    const attended = mine.filter((r) => r.attended === true).length;
    const memberRatings = taughtRecords
      .filter((r) => r.studentId === member.id)
      .map((r) => r.rating)
      .filter((v): v is number => v !== null);
    const avg = average(memberRatings);
    return {
      id: member.id,
      name: member.name,
      playerLevel: member.playerLevel,
      sessionsRecorded: mine.length,
      attended,
      attendanceRate: percent(attended, mine.length),
      avgRating: avg === null ? null : Math.round(avg * 10) / 10,
    };
  });

  const levelCounts = new Map<string, number>();
  for (const member of members) {
    const key = member.playerLevel ?? "sin_nivel";
    levelCounts.set(key, (levelCounts.get(key) ?? 0) + 1);
  }

  const avgRating = average(ratings);
  const avgIntensity = average(
    taughtList.map((s) => s.intensity).filter((v): v is number => v !== null)
  );

  const minutes = taughtList.reduce((sum, s) => sum + s.durationMinutes, 0);

  return {
    taught: taughtList.length,
    upcoming: upcomingList.length,
    hoursTaught: Math.round((minutes / 60) * 10) / 10,
    unrecordedTaught: taughtList.filter((s) => !recordedSessionIds.has(s.id))
      .length,
    attendanceRate: percent(
      attendedRecords.filter((r) => r.attended === true).length,
      attendedRecords.length
    ),
    avgRating: avgRating === null ? null : Math.round(avgRating * 10) / 10,
    avgIntensity:
      avgIntensity === null ? null : Math.round(avgIntensity * 10) / 10,
    ratingsCount: ratings.length,
    lastTaughtAt:
      taughtList.length > 0
        ? taughtList.reduce((latest, s) =>
            s.scheduledAt > latest.scheduledAt ? s : latest
          ).scheduledAt
        : null,
    nextAt: upcomingList[0]?.scheduledAt ?? null,
    levels: [...levelCounts.entries()]
      .map(([level, count]) => ({ level, count }))
      .sort((a, b) => b.count - a.count),
    students,
  };
}
