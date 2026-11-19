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
import { asPartnerConsent, consentRecord, isConsentComplete } from "./consent";
import { promoteFromWaitlist } from "./entries";
import {
  applyPromotions,
  existingIdentities,
  statusOf,
  TournamentError,
  type TournamentRow,
} from "./server";
import { canEditEntries, type TournamentStatus } from "./status";
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
  // Inscripciones de los alumnos de la familia en este torneo. needsConsent:
  // falta el consentimiento de ese jugador y lo puede dar esta cuenta.
  mine: FamilyEntry[];
};

export type FamilyEntry = {
  entryId: string;
  side: "player" | "partner";
  player: string;
  status: string;
  needsConsent: boolean;
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
      id: tournamentEntries.id,
      tournamentId: tournamentEntries.tournamentId,
      studentId: tournamentEntries.studentId,
      partnerStudentId: tournamentEntries.partnerStudentId,
      status: tournamentEntries.status,
      consentAt: tournamentEntries.consentAt,
      partnerConsentAt: tournamentEntries.partnerConsentAt,
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
            (
              [
                ["player", e.studentId, e.consentAt],
                ["partner", e.partnerStudentId, e.partnerConsentAt],
              ] as const
            )
              .filter(([, id]) => !!id && firstName.has(id))
              .map(([side, id, consentAt]) => ({
                entryId: e.id,
                side,
                player: firstName.get(id!)!,
                status: e.status,
                needsConsent:
                  !consentAt &&
                  (e.status === "pending" || e.status === "waitlist") &&
                  canEditEntries({
                    status: t.status as TournamentStatus,
                    registrationDeadline: t.registrationDeadline,
                  }),
              }))
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

/**
 * La familia (o el jugador adulto) da su consentimiento o dice que su
 * jugador no participa. Solo puede hacerlo un tutor activo del alumno de ese
 * lado de la inscripción y mientras no haya empezado el torneo.
 */
export async function familyRespond(
  userId: string,
  entryId: string,
  side: "player" | "partner",
  action: "consent" | "decline",
  opts: { imageConsent?: boolean } = {}
) {
  return db.transaction(async (tx) => {
    const [e] = await tx
      .select()
      .from(tournamentEntries)
      .where(eq(tournamentEntries.id, entryId))
      .limit(1);
    if (!e) throw new TournamentError("not_found", 404);
    const studentId = side === "player" ? e.studentId : e.partnerStudentId;
    if (!studentId) throw new TournamentError("not_found", 404);

    const [guardian] = await tx
      .select({ name: studentGuardians.name })
      .from(studentGuardians)
      .where(
        and(
          eq(studentGuardians.userId, userId),
          eq(studentGuardians.studentId, studentId),
          isNull(studentGuardians.revokedAt)
        )
      )
      .limit(1);
    // Sin vínculo: como si no existiera (no se revela nada).
    if (!guardian) throw new TournamentError("not_found", 404);

    const [t] = (await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, e.tournamentId))
      .for("update")
      .limit(1)) as TournamentRow[];
    if (
      !canEditEntries({
        status: t.status as TournamentStatus,
        registrationDeadline: t.registrationDeadline,
      })
    ) {
      throw new TournamentError("entries_locked", 409);
    }
    if (e.status === "cancelled") {
      throw new TournamentError("entry_cancelled", 409);
    }

    if (action === "decline") {
      await tx
        .update(tournamentEntries)
        .set({ status: "cancelled", cancelledAt: new Date() })
        .where(eq(tournamentEntries.id, entryId));
      const all = await existingIdentities(tx, t.id);
      const promoted = promoteFromWaitlist(
        all.map((x) => ({
          id: x.id,
          status: x.status,
          createdAt: x.createdAt,
          hasConsent: isConsentComplete(x),
        })),
        t.maxEntries
      );
      await applyPromotions(tx, promoted);
      return { status: "cancelled" as const, promoted };
    }

    const r = consentRecord({
      method: "guardian_link",
      byUserId: userId,
      byName: guardian.name,
    });
    if (!r.ok) throw new TournamentError(r.error, 400);
    const fields = side === "player" ? r.record : asPartnerConsent(r.record);
    const after = {
      consentAt: side === "player" ? r.record.consentAt : e.consentAt,
      partnerFirstName: e.partnerFirstName,
      partnerConsentAt:
        side === "partner" ? r.record.consentAt : e.partnerConsentAt,
    };
    const confirm = e.status === "pending" && isConsentComplete(after);
    // Autorización de imagen: se guarda en la ficha del alumno (vale para todo).
    if (opts.imageConsent) {
      await tx
        .update(students)
        .set({
          imageConsent: true,
          imageConsentOn: new Date().toISOString().slice(0, 10),
          imageConsentRef: `Dada por ${guardian.name} desde su cuenta`.slice(
            0,
            200
          ),
          imageConsentBy: userId,
        })
        .where(eq(students.id, studentId));
    }
    await tx
      .update(tournamentEntries)
      .set({
        ...fields,
        ...(confirm && { status: "confirmed", confirmedAt: new Date() }),
      })
      .where(eq(tournamentEntries.id, entryId));
    return {
      status: (confirm ? "confirmed" : e.status) as string,
      promoted: [],
    };
  });
}
