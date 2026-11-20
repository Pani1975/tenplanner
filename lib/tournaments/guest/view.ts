// Datos de un torneo de prueba con la forma que espera la ficha del torneo
// (TournamentManager), igual que hace app/(app)/torneos/[id]/page.tsx con la
// base de datos.

import { imageConsentStatus } from "../image-consent";
import { asTimeZone } from "../schedule";
import { timelineTab, todayInMadrid } from "../timeline";
import type { TournamentStatus } from "../status";
import { guestStatusOf } from "./backend";
import type { GuestDb } from "./store";

export function guestDetail(db: GuestDb, id: string) {
  const t = db.tournaments.find((x) => x.id === id);
  if (!t) return null;
  const effective = guestStatusOf(t);
  const entries = db.entries
    .filter((e) => e.tournamentId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const matches = db.matches
    .filter((m) => m.tournamentId === id)
    .sort((a, b) => a.round - b.round || a.position - b.position);
  return {
    tournament: {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      effectiveStatus: effective,
      modality: t.modality,
      format: t.format,
      levelCode: t.levelCode,
      startDate: t.startDate,
      endDate: t.endDate,
      registrationDeadline: t.registrationDeadline,
      maxEntries: t.maxEntries,
      isClub: false,
      visibility: t.visibility,
      photosPublic: t.photosPublic,
      posterTemplate: t.posterTemplate,
      hasPosterImage: !!t.posterImage,
      archived: !!t.archivedAt,
      canArchive:
        timelineTab(
          {
            status: effective as TournamentStatus,
            startDate: t.startDate,
            endDate: t.endDate,
          },
          todayInMadrid()
        ) === "past",
      schedulePublished: false,
      places: [] as string[],
      placeIds: [] as string[],
      playHours: { mode: "all_day" as const },
      timeZone: asTimeZone(t.timeZone),
      description: t.description,
      rules: {
        bestOf: t.bestOf as 1 | 3 | 5,
        gamesPerSet: t.gamesPerSet,
        finalSet: t.finalSet as "full" | "super_tiebreak",
      },
      circuit: null,
    },
    entries: entries.map((e) => ({
      id: e.id,
      source: e.source,
      status: e.status,
      studentId: null,
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
      consentAt: e.consentAt,
      consentMethod: e.consentMethod,
      createdAt: e.createdAt,
      contactsHidden: false,
      seed: e.seed,
      image: {
        player: imageConsentStatus({
          isStudent: false,
          entryConsentAt: e.imageConsentAt,
        }),
        partner: e.partnerFirstName
          ? imageConsentStatus({
              isStudent: false,
              entryConsentAt: e.partnerImageConsentAt,
            })
          : null,
      },
    })),
    matches: matches.map((m) => ({
      id: m.id,
      round: m.round,
      position: m.position,
      entryAId: m.entryAId,
      entryBId: m.entryBId,
      status: m.status,
      winnerEntryId: m.winnerEntryId,
      score: m.score as never,
      resultType: m.resultType,
      courtLabel: m.courtLabel,
      scheduledAt: m.scheduledAt,
    })),
  };
}

/** Lista de torneos de prueba, como la de /torneos. */
export function guestList(db: GuestDb) {
  return db.tournaments
    .map((t) => {
      const entries = db.entries.filter(
        (e) => e.tournamentId === t.id && e.status !== "cancelled"
      );
      return {
        id: t.id,
        name: t.name,
        status: guestStatusOf(t),
        modality: t.modality,
        format: t.format,
        startDate: t.startDate,
        endDate: t.endDate,
        maxEntries: t.maxEntries,
        taken: entries.filter(
          (e) => e.status === "confirmed" || e.status === "pending"
        ).length,
        archived: !!t.archivedAt,
      };
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}
