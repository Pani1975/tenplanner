import { json, withOrganizer } from "@/lib/tournaments/api";
import { listCircuits } from "@/lib/tournaments/server";

// Circuitos del organizador (club activo o modo particular).
export async function GET() {
  return withOrganizer(async (o) => json(await listCircuits(o)));
}
