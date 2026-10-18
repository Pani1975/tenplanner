import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { groups } from "@/db/schema";

/** El grupo existe y pertenece al espacio de trabajo actual del usuario. */
export async function groupIsInSpace(
  groupId: string,
  userId: string,
  activeClubId: string | null
): Promise<boolean> {
  const [row] = await db
    .select({ id: groups.id })
    .from(groups)
    .where(
      and(
        eq(groups.id, groupId),
        activeClubId
          ? eq(groups.clubId, activeClubId)
          : and(eq(groups.coachId, userId), isNull(groups.clubId))
      )
    )
    .limit(1);
  return !!row;
}
