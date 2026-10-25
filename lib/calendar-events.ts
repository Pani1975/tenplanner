import { and, eq, or, type SQL } from "drizzle-orm";
import { calendarEvents } from "@/db/schema";
import { sharedWithClubCondition } from "@/lib/clubs";
import { getWorkMode } from "@/lib/work-mode";

/**
 * Qué eventos del calendario ve el usuario: los de su modo de trabajo
 * (particulares o compartidos con el club) y, solo en el Espacio gestión, los
 * eventos y tareas que el gestor ha creado ahí, que no ve nadie más.
 */
export function calendarEventsVisibility(
  userId: string,
  activeClubId: string | null,
  managementMode: boolean
): SQL | undefined {
  const shared = sharedWithClubCondition(
    calendarEvents.userId,
    calendarEvents.clubId,
    userId,
    activeClubId
  );
  const notManagement = managementMode
    ? or(
        eq(calendarEvents.management, false),
        eq(calendarEvents.userId, userId)
      )
    : eq(calendarEvents.management, false);
  return and(shared, notManagement);
}

/** ¿Está el usuario en el Espacio gestión de su club? */
export async function isManagementWorkMode(userId: string) {
  const mode = await getWorkMode(userId);
  return mode.kind === "club" && !!mode.management;
}
