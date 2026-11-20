// Archivar torneos y orden de juego (gestión). Solo el organizador; el orden
// de juego, de momento, solo en torneos de club (el club y sus monitores).

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { tournamentMatches, tournaments } from "@/db/schema";
import {
  getTournament,
  statusOf,
  TournamentError,
  type Organizer,
} from "./server";
import { timelineTab, todayInMadrid } from "./timeline";

/** Se puede archivar si ya ha terminado (finalizado o con la fecha pasada). */
export function canArchive(
  t: Parameters<typeof timelineTab>[0],
  today = todayInMadrid()
) {
  return timelineTab(t, today) === "past";
}

export async function setArchived(o: Organizer, id: string, archived: boolean) {
  const t = await getTournament(o, id);
  if (
    archived &&
    !canArchive({
      status: statusOf(t),
      startDate: t.startDate,
      endDate: t.endDate,
    })
  ) {
    throw new TournamentError("not_past", 409);
  }
  await db
    .update(tournaments)
    .set({ archivedAt: archived ? new Date() : null, updatedAt: new Date() })
    .where(eq(tournaments.id, id));
}

async function scheduleTournament(o: Organizer, id: string) {
  const t = await getTournament(o, id);
  // Torneos de club y de prueba (sin cuenta); los de monitor, de momento no.
  if (!t.clubId && t.ownerType !== "guest") {
    throw new TournamentError("schedule_club_only", 403);
  }
  if (statusOf(t) === "draft") throw new TournamentError("draw_required", 409);
  return t;
}

/** Guarda día/hora y pista de varios partidos a la vez. */
export async function saveSchedule(
  o: Organizer,
  id: string,
  items: {
    matchId: string;
    scheduledAt: string | null;
    courtLabel: string | null;
  }[]
) {
  await scheduleTournament(o, id);
  if (!items.length) return;
  const ids = items.map((i) => i.matchId);
  const found = await db
    .select({ id: tournamentMatches.id })
    .from(tournamentMatches)
    .where(
      and(
        eq(tournamentMatches.tournamentId, id),
        inArray(tournamentMatches.id, ids)
      )
    );
  if (found.length !== new Set(ids).size) {
    throw new TournamentError("not_found", 404);
  }
  await db.transaction(async (tx) => {
    for (const i of items) {
      await tx
        .update(tournamentMatches)
        .set({
          scheduledAt: i.scheduledAt ? new Date(i.scheduledAt) : null,
          courtLabel: i.courtLabel?.trim() || null,
        })
        .where(eq(tournamentMatches.id, i.matchId));
    }
  });
}

export async function setSchedulePublished(
  o: Organizer,
  id: string,
  published: boolean
) {
  await scheduleTournament(o, id);
  await db
    .update(tournaments)
    .set({
      schedulePublishedAt: published ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(eq(tournaments.id, id));
}
