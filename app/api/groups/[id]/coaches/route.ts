import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { groups } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getOwnedClub } from "@/lib/clubs";
import { setGroupCoaches } from "@/lib/club-coaches";

const bodySchema = z.object({
  coachIds: z.array(z.string().uuid()).max(100),
});

/**
 * El gestor del club asigna monitores a un grupo del club. Sustituye la
 * lista completa de monitores asignados.
 */
export async function PUT(
  request: Request,
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
    return NextResponse.json(
      { error: "Solo el gestor del club puede asignar monitores." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos no válidos." }, { status: 422 });
  }

  const [group] = await db
    .select({ id: groups.id, sport: groups.sport })
    .from(groups)
    .where(and(eq(groups.id, id), eq(groups.clubId, club.id)))
    .limit(1);
  if (!group) {
    return NextResponse.json(
      { error: "Grupo no encontrado en tu club." },
      { status: 404 }
    );
  }

  const result = await setGroupCoaches({
    groupId: group.id,
    clubId: club.id,
    sport: group.sport,
    userIds: parsed.data.coachIds,
    assignedBy: user.id,
  });
  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          "Algún monitor no está activo en el club para el deporte de este grupo.",
      },
      { status: 422 }
    );
  }
  return NextResponse.json({ data: result.coaches });
}
