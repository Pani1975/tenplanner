import { and, asc, eq, gte, inArray, isNotNull, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  calendarEvents,
  clubs,
  groupStudents,
  groups,
  sessionStudents,
  users,
  sessions,
  students,
  studentGuardians,
  tournamentEntries,
  tournaments,
} from "@/db/schema";
import { acceptsRegistrations, type TournamentStatus } from "@/lib/tournaments/status";
import { playerCategory } from "./category";
import { getPlayerProfile } from "./server";
import type { PlayerLinks } from "./links";

/**
 * Lo que un jugador ve de sus clubes y de los torneos de Ten Planner.
 * Todo parte de su cuenta: alumnos a los que está vinculado como contacto
 * activo (él mismo si es adulto) y su correo para las inscripciones por
 * enlace. Nunca se consulta por un id que venga de la URL.
 */

type LinkedStudent = {
  id: string;
  clubId: string | null;
  coachId: string;
  birthDate: string | null;
};

async function linkedStudents(userId: string): Promise<LinkedStudent[]> {
  const rows = await db
    .select({
      id: students.id,
      clubId: students.clubId,
      coachId: students.coachId,
      birthDate: students.birthDate,
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
  return [...new Map(rows.map((r) => [r.id, r])).values()];
}

/** Clubes a los que está vinculado el jugador (vacío = sin club). */
export async function playerClubIds(userId: string): Promise<string[]> {
  const linked = await linkedStudents(userId);
  return [...new Set(linked.map((s) => s.clubId).filter(Boolean))] as string[];
}

/** Monitores (sin club) que lo tienen como alumno vinculado. */
export async function listPlayerCoaches(
  userId: string
): Promise<{ id: string; name: string; email: string | null }[]> {
  const ids = [
    ...new Set(
      (await linkedStudents(userId)).filter((s) => !s.clubId).map((s) => s.coachId)
    ),
  ];
  if (!ids.length) return [];
  return db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(inArray(users.id, ids))
    .orderBy(asc(users.name));
}

export async function getPlayerLinks(userId: string): Promise<PlayerLinks> {
  const linked = await linkedStudents(userId);
  return {
    club: linked.some((s) => s.clubId),
    monitor: linked.some((s) => !s.clubId),
  };
}

/** Categoría del jugador: de su perfil o, si no, de su ficha en el club. */
export async function playerCategoryFor(userId: string): Promise<string | null> {
  const [profile, linked] = await Promise.all([
    getPlayerProfile(userId),
    linkedStudents(userId),
  ]);
  const birth =
    profile?.birthDate ?? linked.find((s) => s.birthDate)?.birthDate ?? null;
  return playerCategory(birth);
}

export type PlayerTournament = {
  id: string;
  slug: string;
  name: string;
  startDate: string;
  endDate: string | null;
  status: TournamentStatus;
  category: string | null;
  visibility: string;
};

const tournamentFields = {
  id: tournaments.id,
  slug: tournaments.slug,
  name: tournaments.name,
  startDate: tournaments.startDate,
  endDate: tournaments.endDate,
  status: tournaments.status,
  registrationDeadline: tournaments.registrationDeadline,
  category: tournaments.category,
  visibility: tournaments.visibility,
  clubId: tournaments.clubId,
};

/**
 * Torneos del jugador:
 * - `registered`: torneos (no borrador) en los que está inscrito, por su
 *   ficha de alumno o por inscripción con su correo.
 * - `open`: solo si está vinculado a un club; torneos públicos de sus
 *   clubes con inscripción abierta y de su categoría (o sin categoría).
 */
export async function listPlayerTournaments(
  userId: string,
  email: string | null | undefined
): Promise<{
  linked: boolean;
  category: string | null;
  registered: PlayerTournament[];
  open: PlayerTournament[];
}> {
  const linked = await linkedStudents(userId);
  const studentIds = linked.map((s) => s.id);
  const clubIds = [...new Set(linked.map((s) => s.clubId).filter(Boolean))] as string[];
  const mail = email?.trim().toLowerCase() || null;

  const entryMatch = [
    ...(studentIds.length
      ? [
          inArray(tournamentEntries.studentId, studentIds),
          inArray(tournamentEntries.partnerStudentId, studentIds),
        ]
      : []),
    ...(mail ? [sql`lower(${tournamentEntries.email}) = ${mail}`] : []),
  ];

  const registeredRows = entryMatch.length
    ? await db
        .selectDistinct(tournamentFields)
        .from(tournamentEntries)
        .innerJoin(tournaments, eq(tournaments.id, tournamentEntries.tournamentId))
        .where(
          and(
            ne(tournamentEntries.status, "cancelled"),
            ne(tournaments.status, "draft"),
            or(...entryMatch)
          )
        )
        .orderBy(asc(tournaments.startDate))
    : [];

  const category = await playerCategoryFor(userId);
  const registeredIds = new Set(registeredRows.map((r) => r.id));

  const openRows = clubIds.length
    ? (
        await db
          .select(tournamentFields)
          .from(tournaments)
          .where(
            and(
              inArray(tournaments.clubId, clubIds),
              eq(tournaments.visibility, "public"),
              eq(tournaments.status, "open")
            )
          )
          .orderBy(asc(tournaments.startDate))
      ).filter(
        (t) =>
          !registeredIds.has(t.id) &&
          acceptsRegistrations({
            status: t.status as TournamentStatus,
            registrationDeadline: t.registrationDeadline,
          }) &&
          (!t.category || !category || t.category === category)
      )
    : [];

  const toItem = (t: (typeof registeredRows)[number]): PlayerTournament => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    startDate: t.startDate,
    endDate: t.endDate,
    status: t.status as TournamentStatus,
    category: t.category,
    visibility: t.visibility,
  });

  return {
    linked: clubIds.length > 0,
    category,
    registered: registeredRows.map(toItem),
    open: openRows.map(toItem),
  };
}

/** Elemento del calendario del jugador que no es una sesión. */
export type PlayerCalendarItem = {
  id: string;
  kind: "evento" | "torneo" | "tarea";
  title: string;
  /** AAAA-MM-DD, ambos incluidos. */
  startDate: string;
  endDate: string;
  /** Hora de inicio (ISO) si es un evento con hora. */
  startAt: string | null;
  description: string | null;
  href: string | null;
  registered: boolean;
  /** Evento o torneo de uno de sus clubes («Calendario club»). */
  fromClub: boolean;
};

/**
 * Eventos de sus clubes (los del club, no los del Modo gestión) y torneos:
 * los de sus clubes y aquellos en los que está inscrito.
 */
export async function getPlayerCalendarItems(
  userId: string,
  email: string | null | undefined,
  from: Date,
  to: Date
): Promise<PlayerCalendarItem[]> {
  const [clubIds, mine] = await Promise.all([
    playerClubIds(userId),
    listPlayerTournaments(userId, email),
  ]);

  const [events, clubTournaments] = clubIds.length
    ? await Promise.all([
        db
          .select({
            id: calendarEvents.id,
            title: calendarEvents.title,
            description: calendarEvents.description,
            startAt: calendarEvents.startAt,
            endAt: calendarEvents.endAt,
          })
          .from(calendarEvents)
          .where(
            and(
              inArray(calendarEvents.clubId, clubIds),
              eq(calendarEvents.management, false),
              lte(calendarEvents.startAt, to),
              gte(calendarEvents.endAt, from)
            )
          ),
        db
          .select(tournamentFields)
          .from(tournaments)
          .where(
            and(inArray(tournaments.clubId, clubIds), ne(tournaments.status, "draft"))
          ),
      ])
    : [[], []];

  const madridDay = (d: Date) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Madrid",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);

  const items: PlayerCalendarItem[] = events.map((e) => ({
    id: `e-${e.id}`,
    kind: "evento",
    title: e.title,
    startDate: madridDay(e.startAt),
    endDate: madridDay(e.endAt),
    startAt: e.startAt.toISOString(),
    description: e.description,
    href: null,
    registered: false,
    fromClub: true,
  }));

  const registeredIds = new Set(mine.registered.map((t) => t.id));
  const clubTournamentIds = new Set(clubTournaments.map((t) => t.id));
  const allTournaments = new Map<string, PlayerTournament>();
  for (const t of mine.registered) allTournaments.set(t.id, t);
  for (const t of clubTournaments)
    if (!allTournaments.has(t.id))
      allTournaments.set(t.id, {
        id: t.id,
        slug: t.slug,
        name: t.name,
        startDate: t.startDate,
        endDate: t.endDate,
        status: t.status as TournamentStatus,
        category: t.category,
        visibility: t.visibility,
      });

  for (const t of allTournaments.values()) {
    items.push({
      id: `t-${t.id}`,
      kind: "torneo",
      title: t.name,
      startDate: t.startDate,
      endDate: t.endDate ?? t.startDate,
      startAt: null,
      description: null,
      href: t.visibility === "public" ? `/t/${t.slug}` : `/mi-familia/torneos/${t.slug}`,
      registered: registeredIds.has(t.id),
      fromClub: clubTournamentIds.has(t.id),
    });
  }
  return items;
}

/** Sesión del club vista por un jugador: sin alumnos, ejercicios ni asistencia. */
export type ClubSessionSummary = {
  id: string;
  title: string;
  scheduledAt: Date;
  durationMinutes: number;
  status: string;
  objective: string | null;
  location: string | null;
  groupName: string | null;
};

/** Sesiones de sus clubes (pasadas y futuras) en el periodo. */
export async function listClubSessionsForPlayer(
  userId: string,
  from: Date,
  to: Date
): Promise<ClubSessionSummary[]> {
  const linked = await linkedStudents(userId);
  const clubIds = [...new Set(linked.map((s) => s.clubId).filter(Boolean))] as string[];
  const solo = linked.filter((s) => !s.clubId);
  if (!clubIds.length && !solo.length) return [];

  const select = {
    id: sessions.id,
    title: sessions.title,
    scheduledAt: sessions.scheduledAt,
    durationMinutes: sessions.durationMinutes,
    status: sessions.status,
    objective: sessions.objective,
    location: sessions.location,
    groupName: groups.name,
  };
  const range = and(gte(sessions.scheduledAt, from), lte(sessions.scheduledAt, to));

  const clubRows = clubIds.length
    ? await db
        .select(select)
        .from(sessions)
        .leftJoin(groups, eq(groups.id, sessions.groupId))
        .where(and(inArray(sessions.clubId, clubIds), range))
        .orderBy(asc(sessions.scheduledAt))
        .limit(500)
    : [];

  // Monitor sin club: solo las sesiones de sus grupos o en las que figura el
  // jugador, creadas por su monitor (nunca las de otros alumnos del monitor).
  let coachRows: typeof clubRows = [];
  if (solo.length) {
    const studentIds = solo.map((s) => s.id);
    const coachIds = [...new Set(solo.map((s) => s.coachId))];
    const groupRows = await db
      .select({ id: groupStudents.groupId })
      .from(groupStudents)
      .where(inArray(groupStudents.studentId, studentIds));
    const groupIds = groupRows.map((g) => g.id);
    coachRows = await db
      .select(select)
      .from(sessions)
      .leftJoin(groups, eq(groups.id, sessions.groupId))
      .leftJoin(
        sessionStudents,
        and(
          eq(sessionStudents.sessionId, sessions.id),
          inArray(sessionStudents.studentId, studentIds)
        )
      )
      .where(
        and(
          isNull(sessions.clubId),
          inArray(sessions.userId, coachIds),
          groupIds.length
            ? or(inArray(sessions.groupId, groupIds), isNotNull(sessionStudents.studentId))
            : isNotNull(sessionStudents.studentId),
          range
        )
      )
      .orderBy(asc(sessions.scheduledAt))
      .limit(500);
  }
  const all = new Map([...clubRows, ...coachRows].map((r) => [r.id, r]));
  return [...all.values()].sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
}

/** Datos públicos del club al que pertenece el jugador (sin datos de otros alumnos). */
export type PlayerClubInfo = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
};

export async function listPlayerClubs(userId: string): Promise<PlayerClubInfo[]> {
  const ids = await playerClubIds(userId);
  if (!ids.length) return [];
  return db
    .select({
      id: clubs.id,
      name: clubs.name,
      address: clubs.address,
      phone: clubs.phone,
      email: clubs.email,
      website: clubs.website,
    })
    .from(clubs)
    .where(inArray(clubs.id, ids))
    .orderBy(asc(clubs.name));
}
