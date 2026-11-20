// Pasar a la cuenta un torneo de prueba (creado sin registro y guardado en
// el navegador). Se copian el torneo, las inscripciones, el cuadro con sus
// resultados y las noticias; las fotos y la imagen del cartel las sube
// después el navegador con las rutas de siempre.

import { z } from "zod";
import { db } from "@/db";
import {
  tournamentEntries,
  tournamentMatches,
  tournamentNews,
  tournaments,
} from "@/db/schema";
import { TOURNAMENT_CONSENT_VERSION } from "./consent";
import { newsAuthor } from "./media";
import { TOURNAMENT_TIME_ZONES } from "./schedule";
import {
  checkLevel,
  guestExpiry,
  TournamentError,
  type Organizer,
} from "./server";
import { tournamentSlug } from "./slug";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const iso = z.string().datetime({ offset: true });
const text = (max: number) => z.string().trim().max(max).nullable();
const points = z.object({
  a: z.number().int().min(0).max(99),
  b: z.number().int().min(0).max(99),
});

export const importGuestSchema = z.object({
  tournament: z.object({
    name: z.string().trim().min(3).max(160),
    modality: z.enum(["singles", "doubles"]),
    levelCode: z.string().max(32).nullable(),
    format: z.enum(["knockout", "round_robin"]),
    status: z.enum(["draft", "open", "closed", "in_progress", "finished"]),
    posterTemplate: z.enum(["classic", "court", "image"]),
    timeZone: z.enum(TOURNAMENT_TIME_ZONES),
    maxEntries: z.number().int().min(2).max(256).nullable(),
    startDate: date,
    endDate: date.nullable(),
    registrationDeadline: iso.nullable(),
    description: text(2000),
    bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
    gamesPerSet: z.number().int().min(3).max(8),
    finalSet: z.enum(["full", "super_tiebreak"]),
  }),
  entries: z
    .array(
      z.object({
        id: z.string().max(64),
        status: z.enum(["pending", "confirmed", "waitlist", "cancelled"]),
        firstName: z.string().trim().min(1).max(120),
        lastName: text(160),
        email: text(255),
        phone: text(32),
        isMinor: z.boolean(),
        guardianName: text(120),
        guardianEmail: text(255),
        guardianPhone: text(32),
        levelCode: z.string().max(32).nullable(),
        partnerFirstName: text(120),
        partnerLastName: text(160),
        partnerEmail: text(255),
        partnerPhone: text(32),
        partnerIsMinor: z.boolean(),
        partnerGuardianName: text(120),
        partnerGuardianEmail: text(255),
        partnerGuardianPhone: text(32),
        consentAt: iso.nullable(),
        partnerConsentAt: iso.nullable(),
        imageConsentAt: iso.nullable(),
        partnerImageConsentAt: iso.nullable(),
        seed: z.number().int().min(1).max(64).nullable(),
        createdAt: iso,
        confirmedAt: iso.nullable(),
        cancelledAt: iso.nullable(),
      })
    )
    .max(256),
  matches: z
    .array(
      z.object({
        id: z.string().max(64),
        round: z.number().int().min(1).max(64),
        position: z.number().int().min(0).max(512),
        entryAId: z.string().max(64).nullable(),
        entryBId: z.string().max(64).nullable(),
        status: z.enum(["pending", "played", "bye"]),
        winnerEntryId: z.string().max(64).nullable(),
        nextMatchId: z.string().max(64).nullable(),
        nextSlot: z.enum(["a", "b"]).nullable(),
        score: z
          .object({
            sets: z
              .array(points.extend({ tiebreak: points.optional() }))
              .max(5),
            superTiebreak: points.optional(),
          })
          .nullable(),
        resultType: z.enum(["normal", "walkover", "retired"]).nullable(),
        courtLabel: text(60),
      })
    )
    .max(600),
  news: z
    .array(
      z.object({
        title: z.string().trim().min(1).max(160),
        body: z.string().trim().min(1).max(5000),
        publishedAt: iso.nullable(),
        createdAt: iso,
      })
    )
    .max(100),
});

export type ImportGuestInput = z.infer<typeof importGuestSchema>;

const d = (v: string | null) => (v ? new Date(v) : null);

/**
 * Crea el torneo en la cuenta (del club activo o propio, como al crearlo)
 * y devuelve el id nuevo y la equivalencia de inscripciones (para las
 * etiquetas de las fotos).
 */
export async function importGuestTournament(
  o: Organizer,
  input: ImportGuestInput
) {
  const t = input.tournament;
  await checkLevel(t.levelCode, o.sport);
  const entryIds = new Map(
    input.entries.map((e) => [e.id, crypto.randomUUID()])
  );
  const matchIds = new Map(
    input.matches.map((m) => [m.id, crypto.randomUUID()])
  );
  const mapEntry = (id: string | null) => {
    if (!id) return null;
    const v = entryIds.get(id);
    if (!v) throw new TournamentError("invalid_input", 400);
    return v;
  };
  const mapMatch = (id: string | null) => {
    if (!id) return null;
    const v = matchIds.get(id);
    if (!v) throw new TournamentError("invalid_input", 400);
    return v;
  };
  const author = input.news.length
    ? o.guest
      ? {
          authorType: "organizer" as const,
          authorName: o.guest.create?.name || "Organización",
        }
      : await newsAuthor(o)
    : null;

  return db.transaction(async (tx) => {
    const [row] = await tx
      .insert(tournaments)
      .values({
        ...(o.guest?.create
          ? {
              // Versión anterior del modo prueba (navegador) al servidor.
              ownerType: "guest",
              clubId: null,
              coachId: null,
              guestEmail: o.guest.create.email,
              guestName: o.guest.create.name,
              guestTokenHash: o.guest.create.tokenHash,
              guestExpiresAt: guestExpiry(t.startDate, t.endDate),
            }
          : {
              ownerType: o.clubId ? "club" : "coach",
              clubId: o.clubId,
              coachId: o.clubId ? null : o.userId,
            }),
        createdBy: o.userId,
        sport: o.sport,
        name: t.name,
        slug: tournamentSlug(t.name),
        description: t.description,
        modality: t.modality,
        levelCode: t.levelCode,
        format: t.format,
        status: t.status,
        // Al pasar a la cuenta empieza privado: el organizador decide
        // después si lo hace público. En modo prueba, público (inscripción).
        visibility: o.guest ? "public" : "private",
        photosPublic: false,
        posterTemplate:
          t.posterTemplate === "image" ? "classic" : t.posterTemplate,
        timeZone: t.timeZone,
        maxEntries: t.maxEntries,
        startDate: t.startDate,
        endDate: t.endDate,
        registrationDeadline: d(t.registrationDeadline),
        bestOf: t.bestOf,
        gamesPerSet: t.gamesPerSet,
        finalSet: t.finalSet,
      })
      .returning({ id: tournaments.id });

    if (input.entries.length) {
      await tx.insert(tournamentEntries).values(
        input.entries.map((e) => {
          const consentAt = d(e.consentAt);
          const byName = [e.firstName, e.lastName].filter(Boolean).join(" ");
          return {
            id: entryIds.get(e.id)!,
            tournamentId: row.id,
            source: "manual",
            status: e.status,
            firstName: e.firstName,
            lastName: e.lastName,
            email: e.email,
            phone: e.phone,
            isMinor: e.isMinor,
            guardianName: e.guardianName,
            guardianEmail: e.guardianEmail,
            guardianPhone: e.guardianPhone,
            levelCode: e.levelCode,
            partnerFirstName: e.partnerFirstName,
            partnerLastName: e.partnerLastName,
            partnerEmail: e.partnerEmail,
            partnerPhone: e.partnerPhone,
            partnerIsMinor: e.partnerIsMinor,
            partnerGuardianName: e.partnerGuardianName,
            partnerGuardianEmail: e.partnerGuardianEmail,
            partnerGuardianPhone: e.partnerGuardianPhone,
            seed: e.seed,
            // El consentimiento lo declaró quien organizaba la prueba; al
            // pasarlo queda a nombre de la cuenta.
            ...(consentAt && {
              consentAt,
              consentVersion: TOURNAMENT_CONSENT_VERSION,
              consentMethod: "coach_declared",
              consentByUserId: o.userId,
              consentByName: byName,
            }),
            ...(e.partnerConsentAt &&
              e.partnerFirstName && {
                partnerConsentAt: d(e.partnerConsentAt),
                partnerConsentMethod: "coach_declared",
                partnerConsentByUserId: o.userId,
                partnerConsentByName: byName,
              }),
            imageConsentAt: d(e.imageConsentAt),
            partnerImageConsentAt: d(e.partnerImageConsentAt),
            createdAt: new Date(e.createdAt),
            confirmedAt: d(e.confirmedAt),
            cancelledAt: d(e.cancelledAt),
          };
        })
      );
    }

    if (input.matches.length) {
      // Rondas finales primero: el partido siguiente ya existe al insertar.
      const sorted = [...input.matches].sort((a, b) => b.round - a.round);
      await tx.insert(tournamentMatches).values(
        sorted.map((m) => ({
          id: matchIds.get(m.id)!,
          tournamentId: row.id,
          round: m.round,
          position: m.position,
          entryAId: mapEntry(m.entryAId),
          entryBId: mapEntry(m.entryBId),
          status: m.status,
          winnerEntryId: mapEntry(m.winnerEntryId),
          nextMatchId: mapMatch(m.nextMatchId),
          nextSlot: m.nextSlot,
          score: m.score,
          resultType: m.resultType,
          courtLabel: m.courtLabel,
        }))
      );
    }

    if (input.news.length && author) {
      await tx.insert(tournamentNews).values(
        input.news.map((n) => ({
          tournamentId: row.id,
          ...author,
          authorUserId: o.userId,
          title: n.title,
          body: n.body,
          publishedAt: d(n.publishedAt),
          createdAt: new Date(n.createdAt),
        }))
      );
    }

    return { id: row.id, entryIds: Object.fromEntries(entryIds) };
  });
}
