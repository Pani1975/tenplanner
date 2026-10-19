"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { students } from "@/db/schema";
import {
  canTagWithClub,
  getActiveWorkClubId,
  sharedWithClubCondition,
} from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";
import {
  BALLS,
  loadStudentObjectives,
  type ScopeContext,
} from "@/lib/objectives";
import {
  createOwnObjective,
  moveObjectiveFor,
  removeObjectiveFor,
  restoreObjectiveFor,
  updateObjectiveText,
  type WriteScope,
} from "@/lib/objectives-write";

// Personalización desde la ficha del alumno: solo para este alumno o para los
// alumnos particulares del monitor. Los cambios de club están en /club.
type StudentEditScope = Extract<WriteScope, "student" | "coach">;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = z.string().regex(UUID_RE);
const scopeSchema = z.enum(["student", "coach"]);
const text = {
  title: z.string().trim().min(1).max(200),
  criterion: z.string().trim().max(300).optional(),
};

type Failure = { ok: false; error: string };
type Authorized = { ok: true; userId: string; ctx: ScopeContext };

async function authorize(
  studentId: string,
  scope: StudentEditScope
): Promise<Authorized | Failure> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return { ok: false, error: "Unauthorized" };

  const activeClubId = await getActiveWorkClubId(user.id);
  const [student] = await db
    .select({ coachId: students.coachId, clubId: students.clubId })
    .from(students)
    .where(
      and(
        eq(students.id, studentId),
        sharedWithClubCondition(
          students.coachId,
          students.clubId,
          user.id,
          activeClubId
        )
      )
    )
    .limit(1);
  if (!student) return { ok: false, error: "Forbidden" };

  // Un alumno de club no admite cambios solo para el monitor propietario.
  if (scope === "coach" && (student.clubId || student.coachId !== user.id))
    return { ok: false, error: "Forbidden" };
  if (student.clubId && !(await canTagWithClub(user.id, student.clubId))) {
    // El alumno de club solo se edita por miembros activos del club.
    return { ok: false, error: "Forbidden" };
  }

  return {
    ok: true,
    userId: user.id,
    ctx: { studentId, clubId: student.clubId, coachId: student.coachId },
  };
}

function refresh(studentId: string) {
  revalidatePath(`/students/${studentId}`);
}

export async function createObjective(input: {
  studentId: string;
  scope: StudentEditScope;
  ball: string;
  aspect: string;
  block: string;
  title: string;
  criterion?: string;
}) {
  const parsed = z
    .object({
      studentId: uuid,
      scope: scopeSchema,
      ball: z.enum(BALLS.map((b) => b.id) as [string, ...string[]]),
      aspect: z.enum(["tecnico", "tactico", "mental", "fisico"]),
      block: z.string().trim().min(1).max(80),
      ...text,
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.studentId, v.scope);
  if (!auth.ok) return auth;
  const res = await createOwnObjective(auth.ctx, v.scope, auth.userId, {
    ball: v.ball,
    aspect: v.aspect,
    block: v.block,
    title: v.title,
    criterion: v.criterion || null,
  });
  refresh(v.studentId);
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error };
}

export async function updateObjective(input: {
  studentId: string;
  scope: StudentEditScope;
  objectiveId: string;
  title: string;
  criterion?: string;
}) {
  const parsed = z
    .object({
      studentId: uuid,
      scope: scopeSchema,
      objectiveId: uuid,
      ...text,
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.studentId, v.scope);
  if (!auth.ok) return auth;
  const res = await updateObjectiveText(
    auth.ctx,
    v.scope,
    auth.userId,
    v.objectiveId,
    {
      title: v.title,
      criterion: v.criterion ?? "",
    }
  );
  refresh(v.studentId);
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error };
}

export async function removeObjective(input: {
  studentId: string;
  scope: StudentEditScope;
  objectiveId: string;
}) {
  const parsed = z
    .object({ studentId: uuid, scope: scopeSchema, objectiveId: uuid })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.studentId, v.scope);
  if (!auth.ok) return auth;
  const res = await removeObjectiveFor(
    auth.ctx,
    v.scope,
    auth.userId,
    v.objectiveId
  );
  refresh(v.studentId);
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error };
}

export async function restoreObjective(input: {
  studentId: string;
  scope: StudentEditScope;
  objectiveId: string;
}) {
  const parsed = z
    .object({ studentId: uuid, scope: scopeSchema, objectiveId: uuid })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.studentId, v.scope);
  if (!auth.ok) return auth;
  const res = await restoreObjectiveFor(
    auth.ctx,
    v.scope,
    auth.userId,
    v.objectiveId
  );
  refresh(v.studentId);
  return res.ok
    ? { ok: true as const, stillHidden: res.stillHidden }
    : { ok: false as const, error: res.error };
}

export async function moveObjective(input: {
  studentId: string;
  scope: StudentEditScope;
  objectiveId: string;
  direction: "up" | "down";
}) {
  const parsed = z
    .object({
      studentId: uuid,
      scope: scopeSchema,
      objectiveId: uuid,
      direction: z.enum(["up", "down"]),
    })
    .safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Invalid input" };
  const v = parsed.data;

  const auth = await authorize(v.studentId, v.scope);
  if (!auth.ok) return auth;
  const items = await loadStudentObjectives(v.studentId, {
    includeHidden: true,
  });
  const res = await moveObjectiveFor(
    auth.ctx,
    v.scope,
    auth.userId,
    items,
    v.objectiveId,
    v.direction
  );
  refresh(v.studentId);
  return res.ok
    ? { ok: true as const }
    : { ok: false as const, error: res.error };
}
