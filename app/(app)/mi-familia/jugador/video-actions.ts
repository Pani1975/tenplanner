"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { studentGuardians, studentVideos } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  isUuid,
  parseVideoInput,
  toVideoItem,
  type StudentVideoFormInput,
  type VideoActionResult,
} from "@/lib/student-videos";

type Failure = { ok: false; error: string };

/**
 * La familia solo actúa sobre alumnos a los que está vinculada como contacto
 * activo (student_guardians sin baja) y solo gestiona las fichas que ella
 * misma ha creado: no ve ni toca las del monitor.
 */
async function authorizeGuardian(
  studentId: string
): Promise<{ ok: true; userId: string } | Failure> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Unauthorized" };

  const [link] = await db
    .select({ id: studentGuardians.id })
    .from(studentGuardians)
    .where(
      and(
        eq(studentGuardians.studentId, studentId),
        eq(studentGuardians.userId, user.id),
        isNull(studentGuardians.revokedAt)
      )
    )
    .limit(1);
  if (!link) return { ok: false, error: "Forbidden" };
  return { ok: true, userId: user.id };
}

function refresh(studentId: string) {
  revalidatePath("/mi-familia/jugador");
  revalidatePath(`/students/${studentId}`);
}

export async function createFamilyVideo(
  studentId: string,
  input: StudentVideoFormInput
): Promise<VideoActionResult> {
  if (!isUuid(studentId)) return { ok: false, error: "Invalid input" };
  const v = parseVideoInput(input);
  if (!v.ok) return v;
  const auth = await authorizeGuardian(studentId);
  if (!auth.ok) return auth;

  const [row] = await db
    .insert(studentVideos)
    .values({ studentId, createdBy: auth.userId, ...v.data })
    .returning();
  refresh(studentId);
  return { ok: true, video: toVideoItem(row) };
}

export async function updateFamilyVideo(
  studentId: string,
  videoId: string,
  input: StudentVideoFormInput
): Promise<VideoActionResult> {
  if (!isUuid(studentId) || !isUuid(videoId))
    return { ok: false, error: "Invalid input" };
  const v = parseVideoInput(input);
  if (!v.ok) return v;
  const auth = await authorizeGuardian(studentId);
  if (!auth.ok) return auth;

  const [row] = await db
    .update(studentVideos)
    .set(v.data)
    .where(
      and(
        eq(studentVideos.id, videoId),
        eq(studentVideos.studentId, studentId),
        eq(studentVideos.createdBy, auth.userId)
      )
    )
    .returning();
  if (!row) return { ok: false, error: "Not found" };
  refresh(studentId);
  return { ok: true, video: toVideoItem(row) };
}

export async function deleteFamilyVideo(
  studentId: string,
  videoId: string
): Promise<{ ok: true } | Failure> {
  if (!isUuid(studentId) || !isUuid(videoId))
    return { ok: false, error: "Invalid input" };
  const auth = await authorizeGuardian(studentId);
  if (!auth.ok) return auth;

  const deleted = await db
    .delete(studentVideos)
    .where(
      and(
        eq(studentVideos.id, videoId),
        eq(studentVideos.studentId, studentId),
        eq(studentVideos.createdBy, auth.userId)
      )
    )
    .returning({ id: studentVideos.id });
  if (deleted.length === 0) return { ok: false, error: "Not found" };
  refresh(studentId);
  return { ok: true };
}
