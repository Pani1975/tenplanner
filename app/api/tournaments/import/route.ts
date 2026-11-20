import { json, parseBody, withAccountOrganizer } from "@/lib/tournaments/api";
import {
  importGuestSchema,
  importGuestTournament,
} from "@/lib/tournaments/import-guest";

// Pasa a la cuenta un torneo de prueba hecho sin registro (venía guardado
// en el navegador). Devuelve el id nuevo y la equivalencia de inscripciones.
export async function POST(request: Request) {
  return withAccountOrganizer(async (o) => {
    const input = await parseBody(request, importGuestSchema);
    return json(await importGuestTournament(o, input), 201);
  });
}
