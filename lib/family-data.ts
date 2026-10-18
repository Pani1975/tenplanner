import { and, asc, eq, gte, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import {
  calendarHolidays,
  clubs,
  groupStudents,
  groups,
  sessionStudents,
  sessions,
  studentGuardians,
  students,
} from "@/db/schema";
import type { CalendarHolidayData } from "@/lib/calendar/holidays";

/**
 * Datos del panel de familias. Todo se limita a los jugadores a los que el
 * usuario está vinculado como contacto activo (student_guardians sin baja):
 * nunca se consulta por un id que venga solo de la URL. Se exponen
 * únicamente datos pensados para la familia — no las notas internas del
 * alumno ni el detalle de ejercicios de las sesiones.
 */

export interface FamilyPlayer {
  studentId: string;
  name: string;
  birthDate: string | null;
  playerLevel: string | null;
  dominantHand: string | null;
  clubId: string | null;
  clubName: string | null;
  groups: { id: string; name: string }[];
}

export interface FamilySession {
  id: string;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: "scheduled" | "completed" | "cancelled";
  /** Objetivo de la clase (sin entrar en el detalle de los ejercicios). */
  objective: string | null;
  location: string | null;
  groupId: string | null;
  /** Asistencia del jugador: null = el monitor aún no la ha anotado. */
  attended: boolean | null;
}

/** Jugadores vinculados al usuario como contacto activo. */
export async function getFamilyPlayers(
  userId: string
): Promise<FamilyPlayer[]> {
  const rows = await db
    .select({
      studentId: students.id,
      name: students.name,
      birthDate: students.birthDate,
      playerLevel: students.playerLevel,
      dominantHand: students.dominantHand,
      clubId: students.clubId,
      clubName: clubs.name,
    })
    .from(studentGuardians)
    .innerJoin(students, eq(students.id, studentGuardians.studentId))
    .leftJoin(clubs, eq(clubs.id, students.clubId))
    .where(
      and(
        eq(studentGuardians.userId, userId),
        isNull(studentGuardians.revokedAt)
      )
    )
    .orderBy(asc(students.name));

  const unique = new Map<string, (typeof rows)[number]>();
  for (const r of rows) unique.set(r.studentId, r);
  const base = Array.from(unique.values());
  if (base.length === 0) return [];

  const groupRows = await db
    .select({
      studentId: groupStudents.studentId,
      id: groups.id,
      name: groups.name,
      clubId: groups.clubId,
    })
    .from(groupStudents)
    .innerJoin(groups, eq(groups.id, groupStudents.groupId))
    .where(
      inArray(
        groupStudents.studentId,
        base.map((p) => p.studentId)
      )
    )
    .orderBy(asc(groups.name));

  return base.map((p) => ({
    ...p,
    // Solo grupos del mismo club que el alumno.
    groups: groupRows
      .filter((g) => g.studentId === p.studentId && g.clubId === p.clubId)
      .map((g) => ({ id: g.id, name: g.name })),
  }));
}

/** Jugador elegido con ?alumno=; si no es de la familia, el primero. */
export function pickPlayer(
  players: FamilyPlayer[],
  studentId: string | undefined
): FamilyPlayer | null {
  if (players.length === 0) return null;
  return players.find((p) => p.studentId === studentId) ?? players[0];
}

/**
 * Sesiones de los grupos del jugador en el rango, con su asistencia, y los
 * festivos del club que le afectan (de todo el club o de alguno de sus
 * grupos).
 */
export async function getPlayerCalendar(
  player: FamilyPlayer,
  from: Date,
  to: Date
): Promise<{ sessions: FamilySession[]; holidays: CalendarHolidayData[] }> {
  if (!player.clubId) return { sessions: [], holidays: [] };
  const groupIds = player.groups.map((g) => g.id);

  const sessionRows =
    groupIds.length === 0
      ? []
      : await db
          .select({
            id: sessions.id,
            title: sessions.title,
            scheduledAt: sessions.scheduledAt,
            durationMinutes: sessions.durationMinutes,
            status: sessions.status,
            objective: sessions.objective,
            location: sessions.location,
            groupId: sessions.groupId,
            attended: sessionStudents.attended,
          })
          .from(sessions)
          .leftJoin(
            sessionStudents,
            and(
              eq(sessionStudents.sessionId, sessions.id),
              eq(sessionStudents.studentId, player.studentId)
            )
          )
          .where(
            and(
              eq(sessions.clubId, player.clubId),
              inArray(sessions.groupId, groupIds),
              gte(sessions.scheduledAt, from),
              lte(sessions.scheduledAt, to)
            )
          )
          .orderBy(asc(sessions.scheduledAt))
          .limit(1000);

  // Se amplía un día por cada lado para no perder festivos en el borde por
  // la zona horaria; el cliente solo pinta los días que ve.
  const day = 24 * 60 * 60 * 1000;
  const fromStr = new Date(from.getTime() - day).toISOString().slice(0, 10);
  const toStr = new Date(to.getTime() + day).toISOString().slice(0, 10);

  const holidayRows = await db
    .select({
      id: calendarHolidays.id,
      title: calendarHolidays.title,
      description: calendarHolidays.description,
      startDate: calendarHolidays.startDate,
      endDate: calendarHolidays.endDate,
      groupId: calendarHolidays.groupId,
    })
    .from(calendarHolidays)
    .where(
      and(
        eq(calendarHolidays.clubId, player.clubId),
        groupIds.length > 0
          ? or(
              isNull(calendarHolidays.groupId),
              inArray(calendarHolidays.groupId, groupIds)
            )
          : isNull(calendarHolidays.groupId),
        gte(calendarHolidays.endDate, fromStr),
        lte(calendarHolidays.startDate, toStr)
      )
    )
    .orderBy(asc(calendarHolidays.startDate))
    .limit(500);

  return { sessions: sessionRows, holidays: holidayRows };
}
