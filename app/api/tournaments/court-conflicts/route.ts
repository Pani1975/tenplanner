import { z } from "zod";
import { json, parseBody, withAccountOrganizer } from "@/lib/tournaments/api";
import { findCourtConflicts } from "@/lib/tournaments/court-conflicts";
import { tournamentHoursSchema } from "@/lib/tournaments/hours";
import { TOURNAMENT_TIME_ZONES } from "@/lib/tournaments/schedule";
import { checkPlaces } from "@/lib/tournaments/server";

const schema = z.object({
  placeIds: z.array(z.string().uuid()).max(20),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  playHours: tournamentHoursSchema.optional().nullable(),
  timeZone: z.enum(TOURNAMENT_TIME_ZONES).optional(),
});

// Antes de guardar un torneo: sesiones y reservas que ya ocupan sus pistas
// en esos días y horas. El asistente pregunta qué hacer con cada sesión.
export async function POST(request: Request) {
  return withAccountOrganizer(async (o) => {
    const input = await parseBody(request, schema);
    await checkPlaces(o, input.placeIds);
    return json(await findCourtConflicts(input, o.userId));
  });
}
