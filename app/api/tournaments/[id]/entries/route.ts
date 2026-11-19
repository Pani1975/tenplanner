import { getSiteUrl } from "@/lib/email";
import {
  checkIds,
  json,
  parseBody,
  withOrganizer,
} from "@/lib/tournaments/api";
import { notifyGuardiansConsentNeeded } from "@/lib/tournaments/family-notify";
import { addEntriesSchema } from "@/lib/tournaments/schemas";
import { addManualEntry, addSchoolEntries } from "@/lib/tournaments/server";

type Ctx = { params: Promise<{ id: string }> };

// Añadir participantes: alumnos de la escuela (lista) o un jugador externo.
// Alumnos sin consentimiento declarado: se avisa por correo a sus familias
// con cuenta, que pueden darlo desde su menú Torneos.
export async function POST(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  return withOrganizer(async (o) => {
    checkIds(id);
    const input = await parseBody(request, addEntriesSchema);
    if (input.kind !== "school") {
      return json(await addManualEntry(o, id, input), 201);
    }
    const result = await addSchoolEntries(o, id, input);
    let familiesNotified = 0;
    // En borrador no se avisa: la familia aún no ve el torneo; se avisa al
    // abrir las inscripciones.
    if (!input.consentDeclared && result.added.length && !result.isDraft) {
      const added = new Set(result.added.map((a) => a.studentId));
      const studentIds = input.items
        .filter((i) => added.has(i.studentId))
        .flatMap((i) =>
          [i.studentId, i.partnerStudentId].filter((x): x is string => !!x)
        );
      familiesNotified = await notifyGuardiansConsentNeeded(
        id,
        studentIds,
        getSiteUrl(request.url)
      ).catch((e) => {
        console.error("[torneos] aviso a familias", e);
        return 0;
      });
    }
    return json({ ...result, familiesNotified }, 201);
  });
}
