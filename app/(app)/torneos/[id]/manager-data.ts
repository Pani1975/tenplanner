// Datos de la ficha del torneo (TournamentManager) a partir del detalle del
// servidor. Los usan la ficha con cuenta y la del modo prueba.

import { inArray } from "drizzle-orm";
import { db } from "@/db";
import { places } from "@/db/schema";
import { canArchive } from "@/lib/tournaments/schedule-server";
import { asTimeZone } from "@/lib/tournaments/schedule";
import type { getTournamentDetail } from "@/lib/tournaments/server";

type Detail = Awaited<ReturnType<typeof getTournamentDetail>>;

export async function managerData(detail: Detail) {
  const t = detail.tournament;
  const placeNames = t.placeIds?.length
    ? (
        await db
          .select({ name: places.name })
          .from(places)
          .where(inArray(places.id, t.placeIds))
      ).map((p) => p.name)
    : [];
  return {
    tournament: {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      effectiveStatus: t.effectiveStatus,
      modality: t.modality as "singles" | "doubles",
      format: t.format as "knockout" | "round_robin",
      levelCode: t.levelCode,
      startDate: t.startDate,
      endDate: t.endDate,
      registrationDeadline: t.registrationDeadline?.toISOString() ?? null,
      maxEntries: t.maxEntries,
      isClub: t.clubId !== null,
      visibility: t.visibility as "public" | "private",
      photosPublic: t.photosPublic,
      posterTemplate: t.posterTemplate as "classic" | "court" | "image",
      hasPosterImage: !!t.posterImagePath,
      archived: !!t.archivedAt,
      canArchive: canArchive({
        status: t.effectiveStatus,
        startDate: t.startDate,
        endDate: t.endDate,
      }),
      schedulePublished: !!t.schedulePublishedAt,
      places: placeNames,
      placeIds: t.placeIds ?? [],
      playHours: t.playHours ?? { mode: "all_day" },
      timeZone: asTimeZone(t.timeZone),
      circuit: t.circuit,
      description: t.description,
      rules: {
        bestOf: t.bestOf as 1 | 3 | 5,
        gamesPerSet: t.gamesPerSet,
        finalSet: t.finalSet as "full" | "super_tiebreak",
      },
    },
    entries: detail.entries.map((e) => ({
      id: e.id,
      source: e.source,
      status: e.status,
      studentId: e.studentId,
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
      partnerIsMinor: e.partnerIsMinor,
      partnerEmail: e.partnerEmail,
      partnerPhone: e.partnerPhone,
      partnerGuardianName: e.partnerGuardianName,
      partnerGuardianEmail: e.partnerGuardianEmail,
      partnerGuardianPhone: e.partnerGuardianPhone,
      consentAt: e.consentAt?.toISOString() ?? null,
      consentMethod: e.consentMethod,
      createdAt: e.createdAt.toISOString(),
      contactsHidden: e.contactsHidden,
      seed: e.seed,
      image: e.image,
    })),
    matches: detail.matches.map((m) => ({
      id: m.id,
      round: m.round,
      position: m.position,
      entryAId: m.entryAId,
      entryBId: m.entryBId,
      status: m.status,
      winnerEntryId: m.winnerEntryId,
      score: m.score,
      resultType: m.resultType,
      courtLabel: m.courtLabel,
      scheduledAt: m.scheduledAt?.toISOString() ?? null,
    })),
  };
}
