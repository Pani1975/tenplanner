// Torneos para cuentas de familia y de jugador (las vinculadas a alumnos con
// student_guardians). Ven los torneos (públicos y privados, no borradores)
// del club de sus alumnos o, si el alumno es de un monitor particular, los
// de ese monitor. Nunca datos de contacto.

import { and, asc, eq, inArray, isNull, ne, or, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  studentGuardians,
  students,
  tournamentCircuits,
  tournamentEntries,
  tournaments,
} from "@/db/schema";
import { statusOf, type TournamentRow } from "./server";
import type { TournamentStatus } from "./status";
import { timelineTab, todayInMadrid, type TimelineTab } from "./timeline";

type Linked = {
  id: string;
  firstName: string;
  name: string;
  clubId: string | null;
  coachId: string;
};

/** Alumnos vinculados a la cuenta (tutor activo o el propio alumno adulto). */
async function linkedStudents(userId: string): Promise<Linked[]> {
  const rows = await db
    .select({
      id: students.id,
      firstName: students.firstName,
      name: students.name,
      clubId: students.clubId,
      coachId: students.coachId,
    })
    .from(studentGuardians)
    .innerJoin(students, eq(students.id, studentGuardians.studentId))
    .where(
      and(
        eq(studentGuardians.userId, userId),
        isNull(studentGuardians.revokedAt),
        isNull(students.leftAt)
      )
    );
  const unique = new Map(rows.map((r) => [r.id, r]));
  return [...unique.values()].map((r) => ({
    ...r,
    firstName: r.firstName?.trim() || r.name.split(" ")[0],
  }));
}

/** Condición: torneos del club de los alumnos o de su monitor particular. */
function scopeFor(linked: Linked[]): SQL | null {
  const clubIds = [
    ...new Set(linked.map((s) => s.clubId).filter(Boolean)),
  ] as string[];
  const coachIds = [
    ...new Set(linked.filter((s) => !s.clubId).map((s) => s.coachId)),
  ];
  const parts: SQL[] = [];
  if (clubIds.length) parts.push(inArray(tournaments.clubId, clubIds));
  if (coachIds.length) {
    parts.push(
      and(inArray(tournaments.coachId, coachIds), isNull(tournaments.clubId))!
    );
  }
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0] : or(...parts)!;
}

export type FamilyTournament = {
  slug: string;
  name: string;
  startDate: string;
  endDate: string | null;
  status: TournamentStatus;
  visibility: "public" | "private";
  modality: "singles" | "doubles";
  format: "knockout" | "round_robin";
  circuit: string | null;
  tab: TimelineTab;
  // Inscripciones de los alumnos de la familia en este torneo.
  mine: { player: string; status: string }[];
};

export async function listFamilyTournaments(
  userId: string,
  now: Date = new Date()
): Promise<{ hasPlayers: boolean; tournaments: FamilyTournament[] }> {
  const linked = await linkedStudents(userId);
  const scope = scopeFor(linked);
  if (!scope) return { hasPlayers: linked.length > 0, tournaments: [] };

  const rows = await db
    .select({ t: tournaments, circuitName: tournamentCircuits.name })
    .from(tournaments)
    .leftJoin(
      tournamentCircuits,
      eq(tournamentCircuits.id, tournaments.circuitId)
    )
    .where(and(scope, ne(tournaments.status, "draft")))
    .orderBy(asc(tournaments.startDate));
  if (!rows.length) return { hasPlayers: true, tournaments: [] };

  const ids = linked.map((s) => s.id);
  const entries = await db
    .select({
      tournamentId: tournamentEntries.tournamentId,
      studentId: tournamentEntries.studentId,
      partnerStudentId: tournamentEntries.partnerStudentId,
      status: tournamentEntries.status,
    })
    .from(tournamentEntries)
    .where(
      and(
        inArray(
          tournamentEntries.tournamentId,
          rows.map((r) => r.t.id)
        ),
        ne(tournamentEntries.status, "cancelled"),
        or(
          inArray(tournamentEntries.studentId, ids),
          inArray(tournamentEntries.partnerStudentId, ids)
        )
      )
    );
  const firstName = new Map(linked.map((s) => [s.id, s.firstName]));
  const today = todayInMadrid(now);

  return {
    hasPlayers: true,
    tournaments: rows.map(({ t, circuitName }) => {
      const status = statusOf(t);
      return {
        slug: t.slug,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        status,
        visibility: t.visibility as "public" | "private",
        modality: t.modality as "singles" | "doubles",
        format: t.format as "knockout" | "round_robin",
        circuit: circuitName,
        tab: timelineTab(
          { status, startDate: t.startDate, endDate: t.endDate },
          today
        ),
        mine: entries
          .filter((e) => e.tournamentId === t.id)
          .flatMap((e) =>
            [e.studentId, e.partnerStudentId]
              .filter((id): id is string => !!id && firstName.has(id))
              .map((id) => ({ player: firstName.get(id)!, status: e.status }))
          ),
      };
    }),
  };
}

/** ¿Puede esta cuenta de familia o jugador ver el torneo (privado incluido)? */
export async function familyCanView(
  userId: string,
  t: Pick<TournamentRow, "clubId" | "coachId">
): Promise<boolean> {
  const linked = await linkedStudents(userId);
  return linked.some((s) =>
    t.clubId ? s.clubId === t.clubId : !s.clubId && s.coachId === t.coachId
  );
}

export async function getTournamentForFamily(userId: string, slug: string) {
  const [t] = await db
    .select({ clubId: tournaments.clubId, coachId: tournaments.coachId })
    .from(tournaments)
    .where(and(eq(tournaments.slug, slug), ne(tournaments.status, "draft")))
    .limit(1);
  if (!t || !(await familyCanView(userId, t))) return null;
  return t;
}
