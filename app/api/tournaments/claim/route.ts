import { json, withAccountOrganizer } from "@/lib/tournaments/api";
import { claimGuestTournaments } from "@/lib/tournaments/guest-server";

// Pasa a la cuenta los torneos de prueba de este navegador (los que tienen
// aquí su enlace de edición). Dejan de caducar.
export async function POST() {
  return withAccountOrganizer(async (o) =>
    json({ claimed: await claimGuestTournaments(o.userId) })
  );
}
