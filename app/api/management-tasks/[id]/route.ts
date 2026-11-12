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
  taskOwnedBy,
  taskValues,
} from "@/lib/management-tasks";

type Ctx = { params: Promise<{ id: string }> };

async function authorize() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 } as const;
  const clubId = await requireManagementClub(user.id);
  if (!clubId) return { error: "Forbidden", status: 403 } as const;
  return { clubId } as const;
}

// Editar una tarea (o marcarla hecha con { done }) del Modo gestión.
export async function PATCH(request: Request, ctx: Ctx) {
  const auth = await authorize();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;

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

  const [current] = await db
    .select()
    .from(managementTasks)
    .where(taskOwnedBy(auth.clubId, id))
    .limit(1);
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const values = taskValues(parsed.data);
  let coachName: string | null = null;
  if (values.responsibleKind === "coach") {
    const members = await getClubMembersDirectory([auth.clubId]);
    const coach = members.find((m) => m.id === values.responsibleUserId);
    if (!coach)
      return NextResponse.json(
        { error: "El responsable no es un monitor del club" },
        { status: 422 }
      );
    coachName = coach.name;
  }

  // Si cambia la fecha o el aviso, se vuelve a avisar.
  const reminderChanged =
    current.dueDate !== values.dueDate ||
    current.notifyEmail !== values.notifyEmail;
  const doneAt =
    parsed.data.done === undefined
      ? current.doneAt
      : parsed.data.done
        ? (current.doneAt ?? new Date())
        : null;

  const [updated] = await db
    .update(managementTasks)
    .set({
      ...values,
      doneAt,
      ...(reminderChanged ? { notifiedAt: null } : {}),
    })
    .where(taskOwnedBy(auth.clubId, id))
    .returning();

  const [club] = await db
    .select({ name: clubs.name })
    .from(clubs)
    .where(eq(clubs.id, auth.clubId))
    .limit(1);
  return NextResponse.json({
    data: serializeTask(updated, coachName, club?.name ?? "Club"),
  });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const auth = await authorize();
  if ("error" in auth)
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { id } = await ctx.params;

  const [deleted] = await db
    .delete(managementTasks)
    .where(taskOwnedBy(auth.clubId, id))
    .returning({ id: managementTasks.id });
  if (!deleted) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
