// Datos de la parte pública de torneos (sin sesión): página del torneo,
// inscripción por enlace, cancelación desde el correo y clasificación del
// circuito. NUNCA devuelve correo ni teléfono: los nombres salen con
// publicName() (nombre e iniciales de los apellidos).

import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import {
  clubs,
  places,
  tournamentCircuits,
  tournamentEntries,
  tournamentMatches,
  tournaments,
  users,
} from "@/db/schema";
import type { Sport } from "@/lib/sports";
import {
  circuitStandings,
  DEFAULT_POINTS,
  playerKey,
  type CircuitTournament,
} from "./circuit";
import { asPartnerConsent, consentRecord, isConsentComplete } from "./consent";
import {
  allocateNew,
  findDuplicates,
  normalizeEmail,
  normalizePhone,
  promoteFromWaitlist,
  waitlistPosition,
  type EntryStatus,
} from "./entries";
import { publicName, publicTeamName } from "./public-name";
import type { PublicRegistrationInput } from "./schemas";
import type { MatchScore } from "./score";
import {
  applyPromotions,
  checkLevel,
  existingIdentities,
  identityOf,
  statusInput,
  statusOf,
  TournamentError,
  type TournamentRow,
} from "./server";
import { acceptsRegistrations, canEditEntries } from "./status";

async function organizerName(t: {
  clubId: string | null;
  coachId: string | null;
}): Promise<string | null> {
  if (t.clubId) {
    const [c] = await db
      .select({ name: clubs.name })
      .from(clubs)
      .where(eq(clubs.id, t.clubId))
      .limit(1);
    return c?.name ?? null;
  }
  if (t.coachId) {
    const [u] = await db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, t.coachId))
      .limit(1);
    return u?.name ?? null;
  }
  return null;
}

const teamName = (e: {
  firstName: string;
  lastName: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
}) =>
  publicTeamName(
    { firstName: e.firstName, lastName: e.lastName },
    e.partnerFirstName
      ? { firstName: e.partnerFirstName, lastName: e.partnerLastName }
      : null
  );

export type PublicMatch = {
  id: string;
  round: number;
  position: number;
  a: string | null;
  b: string | null;
  aId: string | null;
  bId: string | null;
  status: string;
  winner: "a" | "b" | null;
  score: MatchScore | null;
  resultType: string | null;
};

/**
 * Torneo por su slug (no en borrador), sin datos de contacto. Un torneo
 * privado solo se devuelve con `allowPrivate` (familias y jugadores
 * vinculados, que ya se han comprobado antes).
 */
export async function getPublicTournament(
  slug: string,
  opts: { allowPrivate?: boolean } = {}
) {
  const [t] = await db
    .select()
    .from(tournaments)
    .where(and(eq(tournaments.slug, slug), ne(tournaments.status, "draft")))
    .limit(1);
  if (!t) return null;
  if (t.visibility === "private" && !opts.allowPrivate) return null;

  const [entries, matches, organizer, circuit, placeRows] = await Promise.all([
    db
      .select({
        id: tournamentEntries.id,
        status: tournamentEntries.status,
        firstName: tournamentEntries.firstName,
        lastName: tournamentEntries.lastName,
        partnerFirstName: tournamentEntries.partnerFirstName,
        partnerLastName: tournamentEntries.partnerLastName,
        createdAt: tournamentEntries.createdAt,
        consentAt: tournamentEntries.consentAt,
        partnerConsentAt: tournamentEntries.partnerConsentAt,
      })
      .from(tournamentEntries)
      .where(
        and(
          eq(tournamentEntries.tournamentId, t.id),
          ne(tournamentEntries.status, "cancelled")
        )
      )
      .orderBy(asc(tournamentEntries.createdAt)),
    db
      .select()
      .from(tournamentMatches)
      .where(eq(tournamentMatches.tournamentId, t.id))
      .orderBy(asc(tournamentMatches.round), asc(tournamentMatches.position)),
    organizerName(t),
    t.circuitId
      ? db
          .select({
            name: tournamentCircuits.name,
            season: tournamentCircuits.season,
            slug: tournamentCircuits.slug,
          })
          .from(tournamentCircuits)
          .where(eq(tournamentCircuits.id, t.circuitId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    t.placeIds?.length
      ? db
          .select({ name: places.name })
          .from(places)
          .where(inArray(places.id, t.placeIds))
      : Promise.resolve([] as { name: string }[]),
  ]);

  const queue = entries.map((e) => ({
    id: e.id,
    status: e.status as EntryStatus,
    createdAt: e.createdAt,
    hasConsent: isConsentComplete(e),
  }));
  const names = new Map(entries.map((e) => [e.id, teamName(e)]));
  const inField = entries.filter(
    (e) => e.status === "confirmed" || e.status === "pending"
  );
  const waiting = entries
    .filter((e) => e.status === "waitlist")
    .sort(
      (a, b) =>
        (waitlistPosition(queue, a.id) ?? 0) -
        (waitlistPosition(queue, b.id) ?? 0)
    );

  return {
    slug: t.slug,
    name: t.name,
    description: t.description,
    sport: t.sport as Sport,
    modality: t.modality as "singles" | "doubles",
    format: t.format as "knockout" | "round_robin",
    levelCode: t.levelCode,
    startDate: t.startDate,
    endDate: t.endDate,
    registrationDeadline: t.registrationDeadline?.toISOString() ?? null,
    status: statusOf(t),
    visibility: t.visibility as "public" | "private",
    acceptsRegistrations:
      t.visibility === "public" && acceptsRegistrations(statusInput(t)),
    maxEntries: t.maxEntries,
    // Decisión de David (2026-11-19): el número de inscritos cuenta también
    // la lista de espera.
    registeredCount: entries.length,
    waitlistCount: waiting.length,
    organizer,
    circuit,
    places: placeRows.map((p) => p.name),
    entrants: inField.map((e) => names.get(e.id)!),
    waitlist: waiting.map((e) => names.get(e.id)!),
    rules: {
      bestOf: t.bestOf,
      gamesPerSet: t.gamesPerSet,
      finalSet: t.finalSet,
    },
    matches: matches.map(
      (m): PublicMatch => ({
        id: m.id,
        round: m.round,
        position: m.position,
        a: m.entryAId ? (names.get(m.entryAId) ?? null) : null,
        b: m.entryBId ? (names.get(m.entryBId) ?? null) : null,
        aId: m.entryAId,
        bId: m.entryBId,
        status: m.status,
        winner:
          m.winnerEntryId === null
            ? null
            : m.winnerEntryId === m.entryAId
              ? "a"
              : "b",
        score: m.score,
        resultType: m.resultType,
      })
    ),
  };
}

export type PublicTournament = NonNullable<
  Awaited<ReturnType<typeof getPublicTournament>>
>;

// ── Inscripción por enlace ─────────────────────────────────────────────

export async function registerPublic(
  slug: string,
  input: PublicRegistrationInput
) {
  const [found] = await db
    .select({ id: tournaments.id })
    .from(tournaments)
    .where(and(eq(tournaments.slug, slug), ne(tournaments.status, "draft")))
    .limit(1);
  if (!found) throw new TournamentError("not_found", 404);

  return db.transaction(async (tx) => {
    const [t] = (await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, found.id))
      .for("update")
      .limit(1)) as TournamentRow[];
    if (t.visibility !== "public" || !acceptsRegistrations(statusInput(t))) {
      throw new TournamentError("registration_closed", 409);
    }
    const doubles = t.modality === "doubles";
    if (doubles && !input.partner) {
      throw new TournamentError("partner_required", 400);
    }
    if (!doubles && input.partner) {
      throw new TournamentError("partner_not_allowed", 400);
    }
    await checkLevel(input.levelCode, t.sport as Sport);

    const contact = (x: PublicRegistrationInput["player"]) => ({
      email: x.isMinor ? null : normalizeEmail(x.email),
      phone: x.isMinor ? null : normalizePhone(x.phone),
      guardianName: x.isMinor ? x.guardianName : null,
      guardianEmail: x.isMinor ? normalizeEmail(x.guardianEmail) : null,
      guardianPhone: x.isMinor ? normalizePhone(x.guardianPhone) : null,
    });
    const p = input.player;
    const q = input.partner ?? null;
    const pc = contact(p);
    const qc = q ? contact(q) : null;

    const existing = await existingIdentities(tx, t.id);
    // Duplicado: mismo correo o teléfono propio del jugador o la pareja. Los
    // menores van con el contacto del tutor y no cuentan: dos hermanos
    // pueden compartir tutor.
    const dup = findDuplicates(existing.map(identityOf), [
      identityOf({
        source: "link",
        email: pc.email,
        phone: pc.phone,
        partnerEmail: qc?.email,
        partnerPhone: qc?.phone,
      }),
    ]);
    if (dup.length) throw new TournamentError("duplicate", 409);

    const now = new Date();
    const consent = consentRecord({
      method: "form",
      byName:
        [p, q]
          .filter((x): x is NonNullable<typeof x> => !!x)
          .map((x) =>
            x.isMinor && x.guardianName
              ? x.guardianName
              : `${x.firstName} ${x.lastName}`
          )
          .join(" / ") || p.firstName,
      now,
    });
    if (!consent.ok) throw new TournamentError(consent.error, 400);

    const [status] = allocateNew(existing, t.maxEntries, [
      { hasConsent: true },
    ]);
    const cancelToken = randomBytes(24).toString("base64url");
    const [row] = await tx
      .insert(tournamentEntries)
      .values({
        tournamentId: t.id,
        source: "link",
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
        ...consent.record,
        ...(q ? asPartnerConsent(consent.record) : {}),
        cancelToken,
        imageConsentAt: input.imageConsent ? now : null,
        partnerImageConsentAt: input.imageConsent && q ? now : null,
        confirmedAt: status === "confirmed" ? now : null,
      })
      .returning({
        id: tournamentEntries.id,
        status: tournamentEntries.status,
        createdAt: tournamentEntries.createdAt,
      });

    const position =
      status === "waitlist"
        ? waitlistPosition(
            [
              ...existing.map((e) => ({
                id: e.id,
                status: e.status,
                createdAt: e.createdAt,
                hasConsent: isConsentComplete(e),
              })),
              {
                id: row.id,
                status: "waitlist" as const,
                createdAt: row.createdAt,
                hasConsent: true,
              },
            ],
            row.id
          )
        : null;

    return {
      status: row.status as EntryStatus,
      waitlistPosition: position,
      cancelToken,
      notifyEmail: pc.email ?? pc.guardianEmail,
      playerName: publicName({ firstName: p.firstName, lastName: p.lastName }),
      tournament: { name: t.name, slug: t.slug, startDate: t.startDate },
    };
  });
}

// ── Cancelar desde el enlace del correo ────────────────────────────────

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

/** Inscripción por su token de cancelación (para la página de confirmar). */
export async function findByCancelToken(token: string) {
  if (!TOKEN_RE.test(token)) return null;
  const [row] = await db
    .select({
      status: tournamentEntries.status,
      firstName: tournamentEntries.firstName,
      lastName: tournamentEntries.lastName,
      partnerFirstName: tournamentEntries.partnerFirstName,
      partnerLastName: tournamentEntries.partnerLastName,
      tournamentName: tournaments.name,
      tournamentSlug: tournaments.slug,
    })
    .from(tournamentEntries)
    .innerJoin(tournaments, eq(tournaments.id, tournamentEntries.tournamentId))
    .where(eq(tournamentEntries.cancelToken, token))
    .limit(1);
  if (!row) return null;
  return {
    status: row.status,
    name: teamName(row),
    tournament: { name: row.tournamentName, slug: row.tournamentSlug },
  };
}

export async function cancelByToken(token: string) {
  if (!TOKEN_RE.test(token)) throw new TournamentError("not_found", 404);
  return db.transaction(async (tx) => {
    const [entry] = await tx
      .select({
        id: tournamentEntries.id,
        tournamentId: tournamentEntries.tournamentId,
        status: tournamentEntries.status,
      })
      .from(tournamentEntries)
      .where(eq(tournamentEntries.cancelToken, token))
      .limit(1);
    if (!entry) throw new TournamentError("not_found", 404);
    const [t] = (await tx
      .select()
      .from(tournaments)
      .where(eq(tournaments.id, entry.tournamentId))
      .for("update")
      .limit(1)) as TournamentRow[];
    if (entry.status === "cancelled") {
      return { alreadyCancelled: true, promoted: [], tournament: t };
    }
    if (!canEditEntries(statusInput(t))) {
      throw new TournamentError("entries_locked", 409);
    }
    await tx
      .update(tournamentEntries)
      .set({ status: "cancelled", cancelledAt: new Date() })
      .where(eq(tournamentEntries.id, entry.id));
    const all = await existingIdentities(tx, t.id);
    const promoted = promoteFromWaitlist(
      all.map((e) => ({
        id: e.id,
        status: e.status,
        createdAt: e.createdAt,
        hasConsent: isConsentComplete(e),
      })),
      t.maxEntries
    );
    await applyPromotions(tx, promoted);

    // Contacto de quien entra, para avisarle por correo (solo enlace).
    const promotedContacts = promoted.length
      ? await tx
          .select({
            id: tournamentEntries.id,
            source: tournamentEntries.source,
            email: tournamentEntries.email,
            guardianEmail: tournamentEntries.guardianEmail,
            firstName: tournamentEntries.firstName,
            lastName: tournamentEntries.lastName,
            cancelToken: tournamentEntries.cancelToken,
          })
          .from(tournamentEntries)
          .where(
            inArray(
              tournamentEntries.id,
              promoted.map((p) => p.id)
            )
          )
      : [];
    return {
      alreadyCancelled: false,
      tournament: t,
      promoted: promotedContacts
        .filter((c) => c.source === "link" && (c.email || c.guardianEmail))
        .map((c) => ({
          email: (c.email ?? c.guardianEmail)!,
          playerName: publicName({
            firstName: c.firstName,
            lastName: c.lastName,
          }),
          cancelToken: c.cancelToken,
        })),
    };
  });
}

// ── Clasificación del circuito ─────────────────────────────────────────

export async function getPublicCircuit(slug: string) {
  const [c] = await db
    .select()
    .from(tournamentCircuits)
    .where(eq(tournamentCircuits.slug, slug))
    .limit(1);
  if (!c) return null;

  const ts = await db
    .select()
    .from(tournaments)
    .where(
      and(
        eq(tournaments.circuitId, c.id),
        ne(tournaments.status, "draft"),
        // Los torneos privados no salen en la clasificación pública.
        eq(tournaments.visibility, "public")
      )
    )
    .orderBy(asc(tournaments.startDate));
  const finished = ts.filter((t) => t.status === "finished");
  const ids = finished.map((t) => t.id);

  const [entries, matches, organizer] = await Promise.all([
    ids.length
      ? db
          .select()
          .from(tournamentEntries)
          .where(
            and(
              inArray(tournamentEntries.tournamentId, ids),
              eq(tournamentEntries.status, "confirmed")
            )
          )
      : Promise.resolve([] as (typeof tournamentEntries.$inferSelect)[]),
    ids.length
      ? db
          .select()
          .from(tournamentMatches)
          .where(inArray(tournamentMatches.tournamentId, ids))
      : Promise.resolve([] as (typeof tournamentMatches.$inferSelect)[]),
    organizerName(c),
  ]);

  const input: CircuitTournament[] = finished.map((t) => ({
    id: t.id,
    format: t.format as "knockout" | "round_robin",
    entries: entries
      .filter((e) => e.tournamentId === t.id)
      .map((e) => ({
        id: e.id,
        players: [
          {
            key: playerKey({
              studentId: e.studentId,
              email: e.email ?? e.guardianEmail,
              phone: e.phone ?? e.guardianPhone,
              firstName: e.firstName,
              lastName: e.lastName,
            }),
            name: publicName({ firstName: e.firstName, lastName: e.lastName }),
          },
          ...(e.partnerFirstName
            ? [
                {
                  key: playerKey({
                    studentId: e.partnerStudentId,
                    email: e.partnerEmail ?? e.partnerGuardianEmail,
                    phone: e.partnerPhone ?? e.partnerGuardianPhone,
                    firstName: e.partnerFirstName,
                    lastName: e.partnerLastName,
                  }),
                  name: publicName({
                    firstName: e.partnerFirstName,
                    lastName: e.partnerLastName,
                  }),
                },
              ]
            : []),
        ],
      })),
    matches: matches
      .filter((m) => m.tournamentId === t.id)
      .map((m) => ({
        round: m.round,
        entryA: m.entryAId,
        entryB: m.entryBId,
        status: m.status,
        winner: m.winnerEntryId,
      })),
  }));

  const table = c.points ?? DEFAULT_POINTS;
  const rows = circuitStandings(input, table);
  return {
    name: c.name,
    season: c.season,
    organizer,
    points: table,
    tournaments: ts.map((t) => ({
      slug: t.slug,
      name: t.name,
      startDate: t.startDate,
      status: statusOf(t),
    })),
    // Sin claves internas (correo, ficha): solo nombre público y puntos.
    standings: rows.map((r) => ({
      position: r.position,
      name: r.name,
      points: r.points,
      tournaments: r.tournaments,
      byTournament: finished.map((t) => r.byTournament[t.id] ?? null),
    })),
    finishedNames: finished.map((t) => t.name),
  };
}

export type PublicCircuit = NonNullable<
  Awaited<ReturnType<typeof getPublicCircuit>>
>;
