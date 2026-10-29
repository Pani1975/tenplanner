import { and, eq, gte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import {
  groups,
  groupStudents,
  sessions,
  sessionStudents,
  students,
} from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getBooleanSetting } from "@/lib/app-settings";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { isValidScheduleEntry, sortSchedule } from "@/lib/groups/schedule";

async function ensureGroupsEnabled() {
  const groupsEnabled = await getBooleanSetting("feature.groups_enabled");
  if (groupsEnabled) return null;
  return NextResponse.json(
    { error: "Los grupos de alumnos están desactivados." },
    { status: 403 }
  );
}

type Ctx = { params: Promise<{ id: string }> };

const scheduleEntrySchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    time: z
      .string()
      .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida (HH:MM)"),
  })
  .refine((v) => isValidScheduleEntry(v), { message: "Entrada inválida" });

const updateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  studentIds: z.array(z.string().uuid()).optional(),
  // Días de la semana (y hora) habituales del grupo; [] o null los quita.
  weeklySchedule: z.array(scheduleEntrySchema).max(7).nullable().optional(),
  // Objetivos de trabajo del grupo (texto libre, uno por línea).
  objetivos: z.string().max(4000).nullable().optional(),
});

export async function GET(_req: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const locked = await ensureGroupsEnabled();
  if (locked) return locked;

  const { id } = await ctx.params;

  const activeClubId = await getActiveWorkClubId(user.id);
  const [group] = await db
    .select()
    .from(groups)
    .where(
      and(
        eq(groups.id, id),
        sharedWithClubCondition(
          groups.coachId,
          groups.clubId,
          user.id,
          activeClubId
        )
      )
    )
    .limit(1);
  if (!group) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const memberRows = await db
    .select({
      id: students.id,
      name: students.name,
      imageUrl: students.imageUrl,
      playerLevel: students.playerLevel,
    })
    .from(groupStudents)
    .innerJoin(students, eq(groupStudents.studentId, students.id))
    .where(eq(groupStudents.groupId, id))
    .orderBy(students.name);

  return NextResponse.json({ data: { ...group, students: memberRows } });
}

export async function PATCH(request: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const locked = await ensureGroupsEnabled();
  if (locked) return locked;

  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );

  const [existing] = await db
    .select({ coachId: groups.coachId })
    .from(groups)
    .where(eq(groups.id, id))
    .limit(1);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.coachId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { studentIds, weeklySchedule, ...fields } = parsed.data;

  await db.transaction(async (tx) => {
    if (
      fields.name !== undefined ||
      fields.description !== undefined ||
      fields.objetivos !== undefined ||
      weeklySchedule !== undefined
    ) {
      await tx
        .update(groups)
        .set({
          ...(fields.name !== undefined ? { name: fields.name } : {}),
          ...(fields.description !== undefined
            ? { description: fields.description }
            : {}),
          ...(fields.objetivos !== undefined
            ? { objetivos: fields.objetivos?.trim() || null }
            : {}),
          ...(weeklySchedule !== undefined
            ? {
                weeklySchedule:
                  weeklySchedule && weeklySchedule.length > 0
                    ? sortSchedule(weeklySchedule)
                    : null,
              }
            : {}),
        })
        .where(eq(groups.id, id));
    }

    if (studentIds !== undefined) {
      // Verify all students belong to coach
      if (studentIds.length > 0) {
        const owned = await tx
          .select({ id: students.id })
          .from(students)
          .where(and(eq(students.coachId, user.id)));
        const ownedIds = new Set(owned.map((s) => s.id));
        if (!studentIds.every((sid) => ownedIds.has(sid))) {
          throw new Error("invalid_student");
        }
      }
      const previous = await tx
        .select({ studentId: groupStudents.studentId })
        .from(groupStudents)
        .where(eq(groupStudents.groupId, id));
      const previousIds = new Set(previous.map((p) => p.studentId));
      await tx.delete(groupStudents).where(eq(groupStudents.groupId, id));
      if (studentIds.length > 0) {
        await tx
          .insert(groupStudents)
          .values(studentIds.map((studentId) => ({ groupId: id, studentId })));
      }

      // Las alumnas nuevas del grupo se apuntan a sus próximas sesiones, para
      // que las vean en su ficha.
      const added = studentIds.filter((sid) => !previousIds.has(sid));
      if (added.length > 0) {
        const upcoming = await tx
          .select({ id: sessions.id })
          .from(sessions)
          .where(
            and(eq(sessions.groupId, id), gte(sessions.scheduledAt, new Date()))
          );
        if (upcoming.length > 0) {
          await tx
            .insert(sessionStudents)
            .values(
              upcoming.flatMap((s) =>
                added.map((studentId) => ({ sessionId: s.id, studentId }))
              )
            )
            .onConflictDoNothing();
        }
      }
    }
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const locked = await ensureGroupsEnabled();
  if (locked) return locked;

  const { id } = await ctx.params;

  const [existing] = await db
    .select({ coachId: groups.coachId })
    .from(groups)
    .where(eq(groups.id, id))
    .limit(1);
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (existing.coachId !== user.id)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  await db.delete(groups).where(eq(groups.id, id));
  return NextResponse.json({ ok: true });
}
