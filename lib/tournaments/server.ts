// Acceso a datos de torneos para la gestión (organizador). Toda función
// recibe el organizador y solo ve sus torneos: los del club activo (modo
// club, compartidos con los miembros activos, como alumnos y grupos) o los
// propios en modo particular. La lógica de reglas vive en los módulos puros
// de lib/tournaments/.

import { and, asc, eq, inArray, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import {
  clubs,
  groupStudents,
  groups,
  places,
  skillLevels,
  studentGuardians,
  students,
  tournamentEntries,
  tournamentMatches,
  tournamentCircuits,
  tournaments,
} from "@/db/schema";
import { getActiveWorkClubId, getOwnedClub } from "@/lib/clubs";
import { imageConsentStatus } from "./image-consent";
import { canSeeContacts, redactEntry } from "./privacy";
import { getActiveSport } from "@/lib/sports";
import { scaleSportFor } from "@/lib/skill-levels";
import type { Sport } from "@/lib/sports";
import {
  applyWinner,
  clearResult,
  generateKnockout,
  orderForDraw,
  type BracketMatch,
} from "./bracket";
import {
  asPartnerConsent,
  consentRecord,
  isConsentComplete,
  type ConsentRecord,
} from "./consent";
import {
  allocateNew,
  findDuplicates,
  isMinorStudent,
  normalizeEmail,
  normalizePhone,
  promoteFromWaitlist,
  spotsTaken,
  type EntryIdentity,
  type EntryStatus,
} from "./entries";
import { generateRoundRobin } from "./round-robin";
import type {
  AddManualEntryInput,
  AddSchoolEntriesInput,
  CreateTournamentInput,
  MatchResultBody,
  UpdateTournamentInput,
} from "./schemas";
import { evaluateResult, type ScoringRules } from "./score";
import { tournamentSlug } from "./slug";
import {
  canEditEntries,
  canTransition,
  effectiveStatus,
  type TournamentStatus,
} from "./status";

export class TournamentError extends Error {
  constructor(
    public code: string,
    public status: number,
    public detail?: unknown
  ) {
    super(code);
  }
}

export type Organizer = {
  userId: string;
  clubId: string | null;
  sport: Sport;
  // Datos de contacto de los inscritos: en club, solo su administrador.
  canSeeContacts: boolean;
};

export type TournamentRow = typeof tournaments.$inferSelect;
export type EntryRow = typeof tournamentEntries.$inferSelect;
export type MatchRow = typeof tournamentMatches.$inferSelect;
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Liguilla: con más, demasiados partidos para un torneo de escuela.
export const ROUND_ROBIN_MAX = 16;

export async function getOrganizer(userId: string): Promise<Organizer> {
  const [clubId, sport, owned] = await Promise.all([
    getActiveWorkClubId(userId),
    getActiveSport(userId),
    getOwnedClub(userId),
  ]);
  return {
    userId,
    clubId,
    sport,
    canSeeContacts: canSeeContacts({ clubId, ownedClubId: owned?.id ?? null }),
  };
}

function ownerWhere(o: Organizer): SQL {
  return o.clubId
    ? eq(tournaments.clubId, o.clubId)
    : and(eq(tournaments.coachId, o.userId), isNull(tournaments.clubId))!;
}

/** Alumnos que el organizador puede añadir: los de la escuela del torneo. */
function studentScope(t: TournamentRow): SQL {
  return t.clubId
    ? eq(students.clubId, t.clubId)
    : and(eq(students.coachId, t.coachId!), isNull(students.clubId))!;
}

function groupScope(t: TournamentRow): SQL {
  return and(
    t.clubId
      ? eq(groups.clubId, t.clubId)
      : and(eq(groups.coachId, t.coachId!), isNull(groups.clubId))!,
    eq(groups.sport, t.sport)
  )!;
}

export const rulesOf = (t: TournamentRow): ScoringRules => ({
  bestOf: t.bestOf as 1 | 3 | 5,
  gamesPerSet: t.gamesPerSet,
  finalSet: t.finalSet as ScoringRules["finalSet"],
});

export const statusOf = (t: TournamentRow) =>
  effectiveStatus({
    status: t.status as TournamentStatus,
    registrationDeadline: t.registrationDeadline,
  });

export const statusInput = (t: TournamentRow) => ({
  status: t.status as TournamentStatus,
  registrationDeadline: t.registrationDeadline,
});

// ── Torneos ────────────────────────────────────────────────────────────

export async function listTournaments(o: Organizer) {
  const rows = await db
    .select({
      t: tournaments,
      taken:
        sql<number>`count(${tournamentEntries.id}) filter (where ${tournamentEntries.status} in ('confirmed','pending'))`.mapWith(
          Number
        ),
      waitlist:
        sql<number>`count(${tournamentEntries.id}) filter (where ${tournamentEntries.status} = 'waitlist')`.mapWith(
          Number
        ),
      circuitName: tournamentCircuits.name,
      circuitSeason: tournamentCircuits.season,
    })
    .from(tournaments)
    .leftJoin(
      tournamentEntries,
      eq(tournamentEntries.tournamentId, tournaments.id)
    )
    .leftJoin(
      tournamentCircuits,
      eq(tournamentCircuits.id, tournaments.circuitId)
    )
    .where(and(ownerWhere(o), eq(tournaments.sport, o.sport)))
    .groupBy(tournaments.id, tournamentCircuits.id)
    .orderBy(sql`${tournaments.startDate} desc`);
  return rows.map((r) => ({
    ...r.t,
    effectiveStatus: statusOf(r.t),
    spotsTaken: r.taken,
    waitlistCount: r.waitlist,
    circuit: r.circuitName
      ? { name: r.circuitName, season: r.circuitSeason }
      : null,
  }));
}

// ── Circuitos ──────────────────────────────────────────────────────────

function circuitWhere(o: Organizer): SQL {
  return o.clubId
    ? eq(tournamentCircuits.clubId, o.clubId)
    : and(
        eq(tournamentCircuits.coachId, o.userId),
        isNull(tournamentCircuits.clubId)
      )!;
}

/** Circuitos del organizador (deporte activo), con cuántos torneos tienen. */
export async function listCircuits(o: Organizer) {
  return db
    .select({
      id: tournamentCircuits.id,
      name: tournamentCircuits.name,
      season: tournamentCircuits.season,
      tournaments: sql<number>`count(${tournaments.id})`.mapWith(Number),
    })
    .from(tournamentCircuits)
    .leftJoin(tournaments, eq(tournaments.circuitId, tournamentCircuits.id))
    .where(and(circuitWhere(o), eq(tournamentCircuits.sport, o.sport)))
    .groupBy(tournamentCircuits.id)
    .orderBy(asc(tournamentCircuits.name));
}

/**
 * Circuito del torneo: undefined = no cambia; null = independiente. Un
 * circuito nuevo con el mismo nombre y temporada que uno existente reutiliza
 * ese (sin distinguir mayúsculas), para no duplicarlos por error.
 */
async function resolveCircuit(
  o: Organizer,
  input: {
    circuitId?: string | null;
    newCircuit?: { name: string; season: string | null } | null;
  }
): Promise<string | null | undefined> {
  if (input.newCircuit) {
    const name = input.newCircuit.name.trim();
    const season = input.newCircuit.season?.trim() || null;
    const [existing] = await db
      .select({ id: tournamentCircuits.id })
      .from(tournamentCircuits)
      .where(
        and(
          circuitWhere(o),
          eq(tournamentCircuits.sport, o.sport),
          sql`lower(${tournamentCircuits.name}) = lower(${name})`,
          season
            ? sql`lower(${tournamentCircuits.season}) = lower(${season})`
            : isNull(tournamentCircuits.season)
        )
      )
      .limit(1);
    if (existing) return existing.id;
    const [row] = await db
      .insert(tournamentCircuits)
      .values({
        ownerType: o.clubId ? "club" : "coach",
        clubId: o.clubId,
        coachId: o.clubId ? null : o.userId,
        createdBy: o.userId,
        sport: o.sport,
        name,
        season,
        slug: tournamentSlug(season ? `${name} ${season}` : name),
      })
      .returning({ id: tournamentCircuits.id });
    return row.id;
  }
  if (input.circuitId === undefined) return undefined;
  if (input.circuitId === null) return null;
  const [row] = await db
    .select({ id: tournamentCircuits.id })
    .from(tournamentCircuits)
    .where(and(eq(tournamentCircuits.id, input.circuitId), circuitWhere(o)))
    .limit(1);
  if (!row) throw new TournamentError("circuit_not_found", 400);
  return row.id;
}

export async function getTournament(
  o: Organizer,
  id: string
): Promise<TournamentRow> {
  const [t] = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.id, id), ownerWhere(o)))
    .limit(1);
  if (!t) throw new TournamentError("not_found", 404);
  return t;
}

/** Bloquea la fila del torneo durante la transacción (plazas, cuadro). */
async function lockTournament(tx: Tx, o: Organizer, id: string) {
  const [t] = await tx
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.id, id), ownerWhere(o)))
    .for("update")
    .limit(1);
  if (!t) throw new TournamentError("not_found", 404);
  return t;
}

export async function getTournamentDetail(o: Organizer, id: string) {
  const t = await getTournament(o, id);
  const [entries, matches, circuit] = await Promise.all([
    db
      .select()
      .from(tournamentEntries)
      .where(eq(tournamentEntries.tournamentId, id))
      .orderBy(asc(tournamentEntries.createdAt)),
    db
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, id))
      .orderBy(asc(tournamentMatches.round), asc(tournamentMatches.position)),
    t.circuitId
      ? db
          .select({
            id: tournamentCircuits.id,
            name: tournamentCircuits.name,
            season: tournamentCircuits.season,
            slug: tournamentCircuits.slug,
          })
          .from(tournamentCircuits)
          .where(eq(tournamentCircuits.id, t.circuitId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);
  // Autorización de imagen de los alumnos inscritos (está en su ficha).
  const studentIds = [
    ...new Set(
      entries.flatMap((e) =>
        [e.studentId, e.partnerStudentId].filter((x): x is string => !!x)
      )
    ),
  ];
  const imageByStudent = new Map(
    studentIds.length
      ? (
          await db
            .select({ id: students.id, consent: students.imageConsent })
            .from(students)
            .where(inArray(students.id, studentIds))
        ).map((r) => [r.id, r.consent] as const)
      : []
  );
  return {
    tournament: { ...t, effectiveStatus: statusOf(t), circuit },
    entries: entries.map((e) => ({
      ...redactEntry(e, o.canSeeContacts),
      image: {
        player: imageConsentStatus({
          isStudent: !!e.studentId,
          studentConsent: e.studentId ? imageByStudent.get(e.studentId) : null,
          entryConsentAt: e.imageConsentAt,
        }),
        partner: e.partnerFirstName
          ? imageConsentStatus({
              isStudent: !!e.partnerStudentId,
              studentConsent: e.partnerStudentId
                ? imageByStudent.get(e.partnerStudentId)
                : null,
              entryConsentAt: e.partnerImageConsentAt,
            })
          : null,
      },
    })),
    matches,
  };
}

export async function checkLevel(
  code: string | null | undefined,
  sport: Sport
) {
  if (!code) return;
  const [row] = await db
    .select({ code: skillLevels.code })
    .from(skillLevels)
    .where(
      and(
        eq(skillLevels.code, code),
        eq(skillLevels.sport, scaleSportFor(sport))
      )
    )
    .limit(1);
  if (!row) throw new TournamentError("invalid_level", 400);
}

/** Dueños de las pistas: el monitor y, en modo club, la cuenta del club. */
async function placeOwners(o: Organizer): Promise<string[]> {
  const owners = [o.userId];
  if (o.clubId) {
    const [club] = await db
      .select({ ownerId: clubs.ownerId })
      .from(clubs)
      .where(eq(clubs.id, o.clubId))
      .limit(1);
    if (club && club.ownerId !== o.userId) owners.push(club.ownerId);
  }
  return owners;
}

/** Pistas que puede usar el organizador (para el asistente). */
export async function listPlaces(o: Organizer) {
  return db
    .select({ id: places.id, name: places.name })
    .from(places)
    .where(inArray(places.coachId, await placeOwners(o)))
    .orderBy(asc(places.name));
}

async function checkPlaces(o: Organizer, ids: string[] | null | undefined) {
  if (!ids?.length) return;
  const owners = await placeOwners(o);
  const rows = await db
    .select({ id: places.id })
    .from(places)
    .where(and(inArray(places.id, ids), inArray(places.coachId, owners)));
  if (rows.length !== new Set(ids).size) {
    throw new TournamentError("invalid_places", 400);
  }
}

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" &&
  e !== null &&
  ((e as { code?: string }).code === "23505" ||
    (e as { cause?: { code?: string } }).cause?.code === "23505");

export async function createTournament(
  o: Organizer,
  input: CreateTournamentInput
) {
  await Promise.all([
    checkLevel(input.levelCode, o.sport),
    checkPlaces(o, input.placeIds),
  ]);
  const circuitId = (await resolveCircuit(o, input)) ?? null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const [row] = await db
        .insert(tournaments)
        .values({
          ownerType: o.clubId ? "club" : "coach",
          clubId: o.clubId,
          coachId: o.clubId ? null : o.userId,
          createdBy: o.userId,
          sport: o.sport,
          name: input.name,
          slug: tournamentSlug(input.name),
          description: input.description,
          modality: input.modality,
          levelCode: input.levelCode ?? null,
          format: input.format,
          maxEntries: input.maxEntries ?? null,
          startDate: input.startDate,
          endDate: input.endDate ?? null,
          registrationDeadline: input.registrationDeadline
            ? new Date(input.registrationDeadline)
            : null,
          placeIds: input.placeIds ?? null,
          circuitId,
          visibility: input.visibility ?? "public",
          bestOf: input.bestOf,
          gamesPerSet: input.gamesPerSet,
          finalSet: input.finalSet,
        })
        .returning();
      return row;
    } catch (e) {
      // Choque de slug (improbable): se reintenta con otro sufijo.
      if (!isUniqueViolation(e) || attempt === 2) throw e;
    }
  }
  throw new TournamentError("slug_conflict", 500);
}

export async function updateTournament(
  o: Organizer,
  id: string,
  input: UpdateTournamentInput
) {
  return db.transaction(async (tx) => {
    const t = await lockTournament(tx, o, id);
    const [entryRows, matchRows] = await Promise.all([
      tx
        .select({
          id: tournamentEntries.id,
          status: tournamentEntries.status,
          createdAt: tournamentEntries.createdAt,
          consentAt: tournamentEntries.consentAt,
          partnerFirstName: tournamentEntries.partnerFirstName,
          partnerConsentAt: tournamentEntries.partnerConsentAt,
        })
        .from(tournamentEntries)
        .where(eq(tournamentEntries.tournamentId, id)),
      tx
        .select({ id: tournamentMatches.id, status: tournamentMatches.status })
        .from(tournamentMatches)
        .where(eq(tournamentMatches.tournamentId, id)),
    ]);
    const hasEntries = entryRows.some((e) => e.status !== "cancelled");
    const hasDraw = matchRows.length > 0;

    if (input.modality && input.modality !== t.modality && hasEntries) {
      throw new TournamentError("modality_locked", 409);
    }
    if (input.format && input.format !== t.format && hasDraw) {
      throw new TournamentError("format_locked", 409);
    }
    const scoringChange =
      (input.bestOf !== undefined && input.bestOf !== t.bestOf) ||
      (input.gamesPerSet !== undefined &&
        input.gamesPerSet !== t.gamesPerSet) ||
      (input.finalSet !== undefined && input.finalSet !== t.finalSet);
    if (scoringChange && matchRows.some((m) => m.status === "played")) {
      throw new TournamentError("scoring_locked", 409);
    }

    // Fechas con los valores finales.
    const startDate = input.startDate ?? t.startDate;
    const endDate = input.endDate !== undefined ? input.endDate : t.endDate;
    const deadline =
      input.registrationDeadline !== undefined
        ? input.registrationDeadline
          ? new Date(input.registrationDeadline)
          : null
        : t.registrationDeadline;
    if (endDate && endDate < startDate) {
      throw new TournamentError("invalid_dates", 400);
    }
    if (deadline && deadline.toISOString().slice(0, 10) > startDate) {
      throw new TournamentError("invalid_dates", 400);
    }

    const maxEntries =
      input.maxEntries !== undefined ? input.maxEntries : t.maxEntries;
    const typed = entryRows.map((e) => ({
      ...e,
      status: e.status as EntryStatus,
    }));
    if (maxEntries != null && spotsTaken(typed) > maxEntries) {
      throw new TournamentError("max_below_taken", 409, {
        taken: spotsTaken(typed),
      });
    }

    if (input.status && input.status !== t.status) {
      // in_progress se alcanza al generar el cuadro.
      if (input.status === "in_progress" && !hasDraw) {
        throw new TournamentError("draw_required", 409);
      }
      const ok = canTransition(
        {
          status: t.status as TournamentStatus,
          registrationDeadline: deadline,
        },
        input.status
      );
      if (!ok) throw new TournamentError("invalid_transition", 409);
    }

    await Promise.all([
      input.levelCode !== undefined
        ? checkLevel(input.levelCode, t.sport)
        : null,
      input.placeIds !== undefined ? checkPlaces(o, input.placeIds) : null,
    ]);
    const circuitId = await resolveCircuit(o, input);

    const [row] = await tx
      .update(tournaments)
      .set({
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.modality !== undefined && { modality: input.modality }),
        ...(input.levelCode !== undefined && { levelCode: input.levelCode }),
        ...(input.format !== undefined && { format: input.format }),
        ...(input.maxEntries !== undefined && { maxEntries }),
        ...(input.startDate !== undefined && { startDate }),
        ...(input.endDate !== undefined && { endDate }),
        ...(input.registrationDeadline !== undefined && {
          registrationDeadline: deadline,
        }),
        ...(input.placeIds !== undefined && { placeIds: input.placeIds }),
        ...(circuitId !== undefined && { circuitId }),
        ...(input.visibility !== undefined && { visibility: input.visibility }),
        ...(input.photosPublic !== undefined && {
          photosPublic: input.photosPublic,
        }),
        ...(input.bestOf !== undefined && { bestOf: input.bestOf }),
        ...(input.gamesPerSet !== undefined && {
          gamesPerSet: input.gamesPerSet,
        }),
        ...(input.finalSet !== undefined && { finalSet: input.finalSet }),
        ...(input.status !== undefined && { status: input.status }),
      })
      .where(eq(tournaments.id, id))
      .returning();

    // Más plazas: sube gente de la lista de espera (solo antes del cuadro).
    let promoted: { id: string; status: "confirmed" | "pending" }[] = [];
    if (!hasDraw) {
      promoted = promoteFromWaitlist(
        typed.map((e) => ({
          id: e.id,
          status: e.status,
          createdAt: e.createdAt,
          hasConsent: isConsentComplete(e),
        })),
        maxEntries
      );
      await applyPromotions(tx, promoted);
    }
    return { tournament: row, promoted, previousStatus: t.status };
  });
}

export async function applyPromotions(
  tx: Tx,
  promoted: { id: string; status: "confirmed" | "pending" }[]
) {
  for (const p of promoted) {
    await tx
      .update(tournamentEntries)
      .set({
        status: p.status,
        ...(p.status === "confirmed" && { confirmedAt: new Date() }),
      })
      .where(eq(tournamentEntries.id, p.id));
  }
}

// ── Selector de alumnos ────────────────────────────────────────────────

/**
 * Alumnos activos y grupos de la escuela del torneo, para la pantalla
 * única de selección. Sin datos de contacto.
 */
export async function listCandidates(o: Organizer, id: string) {
  const t = await getTournament(o, id);
  const [studentRows, groupRows, entryRows] = await Promise.all([
    db
      .select({
        id: students.id,
        name: students.name,
        firstName: students.firstName,
        lastName: students.lastName,
        playerLevel: students.playerLevel,
        birthDate: students.birthDate,
      })
      .from(students)
      .where(and(studentScope(t), isNull(students.leftAt)))
      .orderBy(asc(students.name)),
    db
      .select({
        id: groups.id,
        name: groups.name,
        studentId: groupStudents.studentId,
      })
      .from(groups)
      .leftJoin(groupStudents, eq(groupStudents.groupId, groups.id))
      .where(groupScope(t))
      .orderBy(asc(groups.name)),
    db
      .select({
        studentId: tournamentEntries.studentId,
        partnerStudentId: tournamentEntries.partnerStudentId,
        status: tournamentEntries.status,
      })
      .from(tournamentEntries)
      .where(
        and(
          eq(tournamentEntries.tournamentId, id),
          sql`${tournamentEntries.status} <> 'cancelled'`
        )
      ),
  ]);

  const entered = new Map<string, string>();
  for (const e of entryRows) {
    if (e.studentId) entered.set(e.studentId, e.status);
    if (e.partnerStudentId) entered.set(e.partnerStudentId, e.status);
  }
  const groupMap = new Map<
    string,
    { id: string; name: string; studentIds: string[] }
  >();
  const groupsOf = new Map<string, string[]>();
  const activeIds = new Set(studentRows.map((s) => s.id));
  for (const g of groupRows) {
    const entry = groupMap.get(g.id) ?? {
      id: g.id,
      name: g.name,
      studentIds: [],
    };
    if (g.studentId && activeIds.has(g.studentId)) {
      entry.studentIds.push(g.studentId);
      groupsOf.set(g.studentId, [...(groupsOf.get(g.studentId) ?? []), g.id]);
    }
    groupMap.set(g.id, entry);
  }
  return {
    groups: [...groupMap.values()],
    students: studentRows.map((s) => ({
      id: s.id,
      name: s.name,
      levelCode: s.playerLevel,
      isMinor: isMinorStudent(s.birthDate),
      groupIds: groupsOf.get(s.id) ?? [],
      entryStatus: entered.get(s.id) ?? null,
    })),
  };
}

// ── Inscripciones ──────────────────────────────────────────────────────

function splitName(s: {
  name: string;
  firstName: string | null;
  lastName: string | null;
}) {
  if (s.firstName?.trim()) {
    return {
      firstName: s.firstName.trim(),
      lastName: s.lastName?.trim() || null,
    };
  }
  const [first, ...rest] = s.name.trim().split(/\s+/);
  return { firstName: first ?? s.name, lastName: rest.join(" ") || null };
}

type StudentContact = {
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  isMinor: boolean;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  levelCode: string | null;
};

/**
 * Datos del alumno para la inscripción. Menor: el contacto es el de sus
 * padres o tutores (como en Mensajes), nunca el del propio alumno.
 */
async function loadStudentContacts(
  t: TournamentRow,
  ids: string[]
): Promise<Map<string, StudentContact>> {
  const [rows, guardians] = await Promise.all([
    db
      .select({
        id: students.id,
        name: students.name,
        firstName: students.firstName,
        lastName: students.lastName,
        email: students.email,
        phone: students.phone,
        birthDate: students.birthDate,
        playerLevel: students.playerLevel,
      })
      .from(students)
      .where(
        and(inArray(students.id, ids), studentScope(t), isNull(students.leftAt))
      ),
    db
      .select({
        studentId: studentGuardians.studentId,
        name: studentGuardians.name,
        email: studentGuardians.email,
        phone: studentGuardians.phone,
        relationship: studentGuardians.relationship,
      })
      .from(studentGuardians)
      .where(
        and(
          inArray(studentGuardians.studentId, ids),
          isNull(studentGuardians.revokedAt)
        )
      )
      .orderBy(asc(studentGuardians.createdAt)),
  ]);
  const out = new Map<string, StudentContact>();
  for (const s of rows) {
    const minor = isMinorStudent(s.birthDate);
    const g = guardians.find(
      (x) =>
        x.studentId === s.id &&
        x.relationship !== "alumno" &&
        (x.email || x.phone)
    );
    out.set(s.id, {
      ...splitName(s),
      email: minor ? null : normalizeEmail(s.email),
      phone: minor ? null : normalizePhone(s.phone),
      isMinor: minor,
      guardianName: minor ? (g?.name ?? null) : null,
      guardianEmail: minor ? normalizeEmail(g?.email) : null,
      guardianPhone: minor ? normalizePhone(g?.phone) : null,
      levelCode: s.playerLevel,
    });
  }
  return out;
}

export async function existingIdentities(tx: Tx, tournamentId: string) {
  const rows = await tx
    .select({
      id: tournamentEntries.id,
      source: tournamentEntries.source,
      status: tournamentEntries.status,
      studentId: tournamentEntries.studentId,
      partnerStudentId: tournamentEntries.partnerStudentId,
      email: tournamentEntries.email,
      phone: tournamentEntries.phone,
      partnerEmail: tournamentEntries.partnerEmail,
      partnerPhone: tournamentEntries.partnerPhone,
      createdAt: tournamentEntries.createdAt,
      consentAt: tournamentEntries.consentAt,
      partnerFirstName: tournamentEntries.partnerFirstName,
      partnerConsentAt: tournamentEntries.partnerConsentAt,
    })
    .from(tournamentEntries)
    .where(eq(tournamentEntries.tournamentId, tournamentId));
  return rows.map((r) => ({ ...r, status: r.status as EntryStatus }));
}

/** Identidad para duplicados: alumnos por su ficha; externos por contacto. */
export function identityOf(r: {
  source: string;
  status?: EntryStatus;
  studentId?: string | null;
  partnerStudentId?: string | null;
  email?: string | null;
  phone?: string | null;
  partnerEmail?: string | null;
  partnerPhone?: string | null;
}): EntryIdentity {
  if (r.source === "school") {
    return {
      status: r.status,
      studentId: r.studentId,
      partnerStudentId: r.partnerStudentId,
    };
  }
  return {
    status: r.status,
    email: r.email,
    phone: r.phone,
    partnerEmail: r.partnerEmail,
    partnerPhone: r.partnerPhone,
  };
}

const fullName = (c: StudentContact) =>
  [c.firstName, c.lastName].filter(Boolean).join(" ");

export async function addSchoolEntries(
  o: Organizer,
  id: string,
  input: AddSchoolEntriesInput
) {
  const t = await getTournament(o, id);
  if (!canEditEntries(statusInput(t))) {
    throw new TournamentError("entries_locked", 409);
  }
  const doubles = t.modality === "doubles";
  for (const it of input.items) {
    if (doubles && !it.partnerStudentId) {
      throw new TournamentError("partner_required", 400);
    }
    if (!doubles && it.partnerStudentId) {
      throw new TournamentError("partner_not_allowed", 400);
    }
  }

  const ids = [
    ...new Set(
      input.items.flatMap((i) =>
        [i.studentId, i.partnerStudentId].filter((x): x is string => !!x)
      )
    ),
  ];
  const contacts = await loadStudentContacts(t, ids);
  const missing = ids.filter((x) => !contacts.has(x));
  if (missing.length) {
    throw new TournamentError("student_not_found", 400, {
      studentIds: missing,
    });
  }
  const groupIds = [
    ...new Set(
      input.items.map((i) => i.groupId).filter((x): x is string => !!x)
    ),
  ];
  if (groupIds.length) {
    const okGroups = await db
      .select({ id: groups.id })
      .from(groups)
      .where(and(inArray(groups.id, groupIds), groupScope(t)));
    if (okGroups.length !== groupIds.length) {
      throw new TournamentError("group_not_found", 400);
    }
  }

  return db.transaction(async (tx) => {
    const locked = await lockTournament(tx, o, id);
    const existing = await existingIdentities(tx, id);
    const dupIdx = new Set(
      findDuplicates(
        existing.map(identityOf),
        input.items.map((i) =>
          identityOf({
            source: "school",
            studentId: i.studentId,
            partnerStudentId: i.partnerStudentId,
          })
        )
      )
    );
    const fresh = input.items.filter((_, i) => !dupIdx.has(i));
    const skipped = input.items
      .filter((_, i) => dupIdx.has(i))
      .map((i) => ({ studentId: i.studentId, reason: "duplicate" as const }));
    if (!fresh.length)
      return { added: [], skipped, isDraft: locked.status === "draft" };

    const now = new Date();
    const statuses = allocateNew(
      existing,
      locked.maxEntries,
      fresh.map(() => ({ hasConsent: input.consentDeclared }))
    );
    const values = fresh.map((it, i) => {
      const p = contacts.get(it.studentId)!;
      const q = it.partnerStudentId ? contacts.get(it.partnerStudentId)! : null;
      let consent: ConsentRecord | null = null;
      if (input.consentDeclared) {
        // Quién da el permiso: el tutor si es menor, si no el alumno.
        const who = (c: StudentContact) =>
          c.isMinor
            ? (c.guardianName ?? `Familia de ${fullName(c)}`)
            : fullName(c);
        const r = consentRecord({
          method: "coach_declared",
          byUserId: o.userId,
          byName: [p, q]
            .filter((c): c is StudentContact => !!c)
            .map(who)
            .join(" / "),
          now,
        });
        if (r.ok) consent = r.record;
      }
      const status = statuses[i];
      return {
        tournamentId: id,
        source: "school",
        studentId: it.studentId,
        groupId: it.groupId ?? null,
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        isMinor: p.isMinor,
        guardianName: p.guardianName,
        guardianEmail: p.guardianEmail,
        guardianPhone: p.guardianPhone,
        levelCode: p.levelCode,
        partnerStudentId: it.partnerStudentId ?? null,
        partnerFirstName: q?.firstName ?? null,
        partnerLastName: q?.lastName ?? null,
        partnerEmail: q?.email ?? null,
        partnerPhone: q?.phone ?? null,
        partnerIsMinor: q?.isMinor ?? false,
        partnerGuardianName: q?.guardianName ?? null,
        partnerGuardianEmail: q?.guardianEmail ?? null,
        partnerGuardianPhone: q?.guardianPhone ?? null,
        status,
        ...(consent ?? {}),
        ...(consent && q ? asPartnerConsent(consent) : {}),
        confirmedAt: status === "confirmed" ? now : null,
      };
    });
    const added = await tx.insert(tournamentEntries).values(values).returning({
      id: tournamentEntries.id,
      studentId: tournamentEntries.studentId,
      status: tournamentEntries.status,
    });
    return { added, skipped, isDraft: locked.status === "draft" };
  });
}

export async function addManualEntry(
  o: Organizer,
  id: string,
  input: AddManualEntryInput
) {
  const t = await getTournament(o, id);
  if (!canEditEntries(statusInput(t))) {
    throw new TournamentError("entries_locked", 409);
  }
  const doubles = t.modality === "doubles";
  if (doubles && !input.partner)
    throw new TournamentError("partner_required", 400);
  if (!doubles && input.partner) {
    throw new TournamentError("partner_not_allowed", 400);
  }
  await checkLevel(input.levelCode, t.sport);

  const p = input.player;
  const q = input.partner ?? null;
  const contact = (x: typeof p) => ({
    email: x.isMinor ? null : normalizeEmail(x.email),
    phone: x.isMinor ? null : normalizePhone(x.phone),
    guardianName: x.isMinor ? x.guardianName : null,
    guardianEmail: x.isMinor ? normalizeEmail(x.guardianEmail) : null,
    guardianPhone: x.isMinor ? normalizePhone(x.guardianPhone) : null,
  });
  const pc = contact(p);
  const qc = q ? contact(q) : null;

  return db.transaction(async (tx) => {
    const locked = await lockTournament(tx, o, id);
    const existing = await existingIdentities(tx, id);
    const dup = findDuplicates(existing.map(identityOf), [
      identityOf({
        source: "manual",
        email: pc.email,
        phone: pc.phone,
        partnerEmail: qc?.email,
        partnerPhone: qc?.phone,
      }),
    ]);
    if (dup.length) throw new TournamentError("duplicate", 409);

    const now = new Date();
    const [status] = allocateNew(existing, locked.maxEntries, [
      { hasConsent: input.consentDeclared },
    ]);
    let consent: ConsentRecord | null = null;
    if (input.consentDeclared) {
      const who = (x: typeof p, c: typeof pc) =>
        x.isMinor && c.guardianName
          ? c.guardianName
          : `${x.firstName} ${x.lastName}`;
      const r = consentRecord({
        method: "coach_declared",
        byUserId: o.userId,
        byName: [who(p, pc), q && qc ? who(q, qc) : null]
          .filter(Boolean)
          .join(" / "),
        now,
      });
      if (r.ok) consent = r.record;
    }
    const [row] = await tx
      .insert(tournamentEntries)
      .values({
        tournamentId: id,
        source: "manual",
        imageConsentAt: input.imageConsent ? new Date() : null,
        partnerImageConsentAt: input.imageConsent && q ? new Date() : null,
        firstName: p.firstName,
        lastName: p.lastName,
        ...pc,
        isMinor: p.isMinor,
        levelCode: input.levelCode ?? null,
        partnerFirstName: q?.firstName ?? null,
        partnerLastName: q?.lastName ?? null,
        partnerEmail: qc?.email ?? null,
        partnerPhone: qc?.phone ?? null,
        partnerIsMinor: q?.isMinor ?? false,
        partnerGuardianName: qc?.guardianName ?? null,
        partnerGuardianEmail: qc?.guardianEmail ?? null,
        partnerGuardianPhone: qc?.guardianPhone ?? null,
        status,
        ...(consent ?? {}),
        ...(consent && q ? asPartnerConsent(consent) : {}),
        confirmedAt: status === "confirmed" ? now : null,
      })
      .returning();
    return { entry: redactEntry(row, o.canSeeContacts) };
  });
}

export async function updateEntry(
  o: Organizer,
  tournamentId: string,
  entryId: string,
  action:
    | { action: "declare_consent" }
    | { action: "cancel" }
    | { action: "seed"; seed: number | null }
) {
  return db.transaction(async (tx) => {
    const t = await lockTournament(tx, o, tournamentId);
    const all = await existingIdentities(tx, tournamentId);
    const entry = all.find((e) => e.id === entryId);
    if (!entry) throw new TournamentError("not_found", 404);

    if (action.action === "seed") {
      const [hasDraw] = await tx
        .select({ id: tournamentMatches.id })
        .from(tournamentMatches)
        .where(eq(tournamentMatches.tournamentId, tournamentId))
        .limit(1);
      if (hasDraw) throw new TournamentError("draw_exists", 409);
      await tx
        .update(tournamentEntries)
        .set({ seed: action.seed })
        .where(eq(tournamentEntries.id, entryId));
      return { promoted: [] };
    }

    if (action.action === "declare_consent") {
      if (entry.status === "cancelled") {
        throw new TournamentError("entry_cancelled", 409);
      }
      const [full] = await tx
        .select()
        .from(tournamentEntries)
        .where(eq(tournamentEntries.id, entryId))
        .limit(1);
      const who = (
        first: string | null,
        last: string | null,
        minor: boolean,
        guardian: string | null
      ) =>
        minor
          ? (guardian ??
            `Familia de ${[first, last].filter(Boolean).join(" ")}`)
          : [first, last].filter(Boolean).join(" ");
      const r = consentRecord({
        method: "coach_declared",
        byUserId: o.userId,
        byName: [
          who(full.firstName, full.lastName, full.isMinor, full.guardianName),
          full.partnerFirstName
            ? who(
                full.partnerFirstName,
                full.partnerLastName,
                full.partnerIsMinor,
                full.partnerGuardianName
              )
            : null,
        ]
          .filter(Boolean)
          .join(" / "),
      });
      if (!r.ok) throw new TournamentError(r.error, 400);
      await tx
        .update(tournamentEntries)
        .set({
          ...r.record,
          // El monitor declara por toda la inscripción (también la pareja).
          ...(full.partnerFirstName ? asPartnerConsent(r.record) : {}),
          ...(entry.status === "pending" && {
            status: "confirmed",
            confirmedAt: new Date(),
          }),
        })
        .where(eq(tournamentEntries.id, entryId));
      return { promoted: [] };
    }

    // cancel
    if (!canEditEntries(statusInput(t))) {
      // Con el torneo en marcha, la baja es un walkover en su partido.
      throw new TournamentError("entries_locked", 409);
    }
    if (entry.status === "cancelled") return { promoted: [] };
    await tx
      .update(tournamentEntries)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(tournamentEntries.id, entryId));
    const after = all.map((e) =>
      e.id === entryId ? { ...e, status: "cancelled" as EntryStatus } : e
    );
    const promoted = promoteFromWaitlist(
      after.map((e) => ({
        id: e.id,
        status: e.status,
        createdAt: e.createdAt,
        hasConsent: isConsentComplete(e),
      })),
      t.maxEntries
    );
    await applyPromotions(tx, promoted);
    return { promoted };
  });
}

// ── Cuadro y resultados ────────────────────────────────────────────────

export async function generateDraw(
  o: Organizer,
  id: string,
  opts: { excludePending: boolean }
) {
  return db.transaction(async (tx) => {
    const t = await lockTournament(tx, o, id);
    // Cerrado: primer cuadro. En curso: rehacerlo, solo si aún no hay
    // resultados (se comprueba más abajo).
    const current = statusOf(t);
    if (current !== "closed" && current !== "in_progress") {
      throw new TournamentError("must_be_closed", 409);
    }
    const entries = await existingIdentities(tx, id);
    const pending = entries.filter((e) => e.status === "pending");
    if (pending.length && !opts.excludePending) {
      throw new TournamentError("pending_consent", 409, {
        count: pending.length,
      });
    }
    const confirmed = await tx
      .select({ id: tournamentEntries.id, seed: tournamentEntries.seed })
      .from(tournamentEntries)
      .where(
        and(
          eq(tournamentEntries.tournamentId, id),
          eq(tournamentEntries.status, "confirmed")
        )
      )
      .orderBy(asc(tournamentEntries.createdAt));
    if (confirmed.length < 2)
      throw new TournamentError("not_enough_entries", 409);
    if (t.format === "round_robin" && confirmed.length > ROUND_ROBIN_MAX) {
      throw new TournamentError("too_many_for_round_robin", 409, {
        max: ROUND_ROBIN_MAX,
      });
    }

    const old = await tx
      .select({ status: tournamentMatches.status })
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, id));
    if (old.some((m) => m.status === "played")) {
      throw new TournamentError("results_exist", 409);
    }
    if (old.length) {
      await tx
        .delete(tournamentMatches)
        .where(eq(tournamentMatches.tournamentId, id));
    }

    if (t.format === "knockout") {
      const bracket = generateKnockout(orderForDraw(confirmed));
      const ids = new Map(bracket.map((m) => [m.key, crypto.randomUUID()]));
      // Rondas finales primero: el partido siguiente ya existe al insertar.
      const rows = [...bracket]
        .sort((a, b) => b.round - a.round)
        .map((m) => ({
          id: ids.get(m.key)!,
          tournamentId: id,
          round: m.round,
          position: m.position,
          entryAId: m.entryA,
          entryBId: m.entryB,
          status: m.status,
          winnerEntryId: m.winner,
          nextMatchId: m.nextKey ? ids.get(m.nextKey)! : null,
          nextSlot: m.nextSlot,
        }));
      await tx.insert(tournamentMatches).values(rows);
    } else {
      const pairings = generateRoundRobin(confirmed.map((e) => e.id));
      await tx.insert(tournamentMatches).values(
        pairings.map((p) => ({
          tournamentId: id,
          round: p.round,
          position: p.position,
          entryAId: p.entryA,
          entryBId: p.entryB,
        }))
      );
    }
    await tx
      .update(tournaments)
      .set({ status: "in_progress" })
      .where(eq(tournaments.id, id));
    return tx
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, id))
      .orderBy(asc(tournamentMatches.round), asc(tournamentMatches.position));
  });
}

const toBracket = (rows: MatchRow[]): BracketMatch[] =>
  rows.map((m) => ({
    key: m.id,
    round: m.round,
    position: m.position,
    entryA: m.entryAId,
    entryB: m.entryBId,
    status: m.status as BracketMatch["status"],
    winner: m.winnerEntryId,
    nextKey: m.nextMatchId,
    nextSlot: (m.nextSlot as "a" | "b" | null) ?? null,
  }));

/** Guarda los cambios de cuadro (ganador y huecos del partido siguiente). */
async function persistBracket(
  tx: Tx,
  before: BracketMatch[],
  after: BracketMatch[]
) {
  const prev = new Map(before.map((m) => [m.key, m]));
  for (const m of after) {
    const p = prev.get(m.key)!;
    if (p.entryA === m.entryA && p.entryB === m.entryB) continue;
    await tx
      .update(tournamentMatches)
      .set({ entryAId: m.entryA, entryBId: m.entryB })
      .where(eq(tournamentMatches.id, m.key));
  }
}

export async function recordResult(
  o: Organizer,
  id: string,
  matchId: string,
  body: MatchResultBody
) {
  return db.transaction(async (tx) => {
    const t = await lockTournament(tx, o, id);
    if (statusOf(t) !== "in_progress") {
      throw new TournamentError("not_in_progress", 409);
    }
    const rows = await tx
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, id));
    const match = rows.find((m) => m.id === matchId);
    if (!match) throw new TournamentError("not_found", 404);
    if (match.status === "bye") throw new TournamentError("bye_match", 409);
    if (!match.entryAId || !match.entryBId) {
      throw new TournamentError("missing_opponent", 409);
    }

    const result = evaluateResult(
      { resultType: body.resultType, score: body.score, winner: body.winner },
      rulesOf(t)
    );
    if (!result.ok) throw new TournamentError(result.error, 400);
    const winnerId = result.winner === "a" ? match.entryAId : match.entryBId;

    if (t.format === "knockout") {
      const before = toBracket(rows);
      const applied = applyWinner(before, matchId, winnerId);
      if (!applied.ok) throw new TournamentError(applied.error, 409);
      await persistBracket(tx, before, applied.matches);
    }
    const [row] = await tx
      .update(tournamentMatches)
      .set({
        status: "played",
        resultType: result.resultType,
        score: result.score,
        winnerEntryId: winnerId,
        ...(body.scheduledAt !== undefined && {
          scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : null,
        }),
        ...(body.courtLabel !== undefined && { courtLabel: body.courtLabel }),
      })
      .where(eq(tournamentMatches.id, matchId))
      .returning();
    return row;
  });
}

export async function clearMatchResult(
  o: Organizer,
  id: string,
  matchId: string
) {
  return db.transaction(async (tx) => {
    const t = await lockTournament(tx, o, id);
    if (statusOf(t) !== "in_progress") {
      throw new TournamentError("not_in_progress", 409);
    }
    const rows = await tx
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, id));
    const match = rows.find((m) => m.id === matchId);
    if (!match) throw new TournamentError("not_found", 404);
    if (match.status === "bye") throw new TournamentError("bye_match", 409);
    if (t.format === "knockout") {
      const before = toBracket(rows);
      const cleared = clearResult(before, matchId);
      if (!cleared.ok) throw new TournamentError(cleared.error, 409);
      await persistBracket(tx, before, cleared.matches);
    }
    await tx
      .update(tournamentMatches)
      .set({
        status: "pending",
        resultType: null,
        score: null,
        winnerEntryId: null,
      })
      .where(eq(tournamentMatches.id, matchId));
  });
}
