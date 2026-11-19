import { json, parseBody, withOrganizer } from "@/lib/tournaments/api";
import { createTournamentSchema } from "@/lib/tournaments/schemas";
import { createTournament, listTournaments } from "@/lib/tournaments/server";

// Torneos del organizador (club activo o modo particular, deporte activo).
export async function GET() {
  return withOrganizer(async (o) => json(await listTournaments(o)));
}

export async function POST(request: Request) {
  return withOrganizer(async (o) => {
    const input = await parseBody(request, createTournamentSchema);
    return json(await createTournament(o, input), 201);
  });
}
