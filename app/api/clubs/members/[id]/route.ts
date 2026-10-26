import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubMembers } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getOwnedClub } from "@/lib/clubs";
import { clearCoachAssignments } from "@/lib/club-coaches";

/**
 * El dueño del club desvincula a un monitor (marca la vinculación como
 * "removed"). El contenido que el monitor creó en el club se queda en el
 * club; él deja de verlo al perder la vinculación. También se le quita de
 * los grupos y alumnos a los que el gestor lo había asignado.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const club = await getOwnedClub(user.id);
  if (!club) {
    return NextResponse.json({ error: "No tienes un club." }, { status: 403 });
  }

  const [updated] = await db
    .update(clubMembers)
    .set({ status: "removed" })
    .where(
      and(
        eq(clubMembers.id, id),
        eq(clubMembers.clubId, club.id),
        eq(clubMembers.role, "coach")
      )
    )
    .returning({
      id: clubMembers.id,
      userId: clubMembers.userId,
      sport: clubMembers.sport,
    });

  if (!updated) {
    return NextResponse.json(
      { error: "Monitor no encontrado." },
      { status: 404 }
    );
  }
  // Ya no es monitor de ese deporte: fuera también de sus grupos y alumnos.
  await clearCoachAssignments({
    clubId: club.id,
    userId: updated.userId,
    sport: updated.sport,
  });
  return NextResponse.json({ ok: true });
}
