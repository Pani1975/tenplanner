import { json, parseBody, withOrganizer } from "@/lib/tournaments/api";
import { cancelConflictingSessions } from "@/lib/tournaments/court-conflicts";
import { createTournamentSchema } from "@/lib/tournaments/schemas";
import { createTournament, listTournaments } from "@/lib/tournaments/server";

// Torneos del organizador (club activo o modo particular, deporte activo).
export async function GET() {
  return withOrganizer(async (o) => json(await listTournaments(o)));
}

export async function POST(request: Request) {
  return withOrganizer(async (o) => {
    const input = await parseBody(request, createTournamentSchema);
    const row = await createTournament(o, input);
    // Sesiones que coinciden y el organizador ha decidido cancelar.
    const cancelled = await cancelConflictingSessions(
      row,
      input.cancelSessionIds ?? [],
      row.name,
      o.userId
    ).catch((e) => {
      console.error("[torneos] cancelar sesiones", e);
      return { cancelled: 0, notified: 0 };
    });
    return json({ ...row, sessionsCancelled: cancelled }, 201);
  });
}
