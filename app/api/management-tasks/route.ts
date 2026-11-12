import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { clubs, managementTasks } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getClubMembersDirectory } from "@/lib/clubs";
import {
  requireManagementClub,
  serializeTask,
  taskInputSchema,
  taskValues,
} from "@/lib/management-tasks";

// Crear una tarea del Modo gestión. Solo la cuenta del club, con el Modo
// gestión activo.
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const clubId = await requireManagementClub(user.id);
  if (!clubId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = taskInputSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );

  const values = taskValues(parsed.data);
  let coachName: string | null = null;
  if (values.responsibleKind === "coach") {
    const members = await getClubMembersDirectory([clubId]);
    const coach = members.find((m) => m.id === values.responsibleUserId);
    if (!coach)
      return NextResponse.json(
        { error: "El responsable no es un monitor del club" },
        { status: 422 }
      );
    coachName = coach.name;
  }

  const [club] = await db
    .select({ name: clubs.name })
    .from(clubs)
    .where(eq(clubs.id, clubId))
    .limit(1);
  const [created] = await db
    .insert(managementTasks)
    .values({ ...values, clubId, createdBy: user.id })
    .returning();

  return NextResponse.json(
    { data: serializeTask(created, coachName, club?.name ?? "Club") },
    { status: 201 }
  );
}
