"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { students, studentVideos } from "@/db/schema";
import {
  canTagWithClub,
  getActiveWorkClubId,
  sharedWithClubCondition,
} from "@/lib/clubs";
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
 * Mismas reglas que el resto de la ficha: el alumno tiene que ser visible para
 * el usuario (propio o compartido en su club activo) y, si es de un club, solo
 * lo editan los miembros activos de ese club.
 */
async function authorize(
  studentId: string
): Promise<{ ok: true; userId: string } | Failure> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  if (!user) return { ok: false, error: "Unauthorized" };

  const activeClubId = await getActiveWorkClubId(user.id);
  const [student] = await db
    .select({ clubId: students.clubId })
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
  if (student.clubId && !(await canTagWithClub(user.id, student.clubId))) {
    return { ok: false, error: "Forbidden" };
  }
  return { ok: true, userId: user.id };
}

function refresh(studentId: string) {
  revalidatePath(`/students/${studentId}`);
  revalidatePath(`/students/${studentId}/edit`);
}

export async function createStudentVideo(
  studentId: string,
  input: StudentVideoFormInput
): Promise<VideoActionResult> {
  if (!isUuid(studentId)) return { ok: false, error: "Invalid input" };
  const v = parseVideoInput(input);
  if (!v.ok) return v;
  const auth = await authorize(studentId);
  if (!auth.ok) return auth;

  const [row] = await db
    .insert(studentVideos)
    .values({ studentId, createdBy: auth.userId, ...v.data })
    .returning();
  refresh(studentId);
  return { ok: true, video: toVideoItem(row) };
}

export async function updateStudentVideo(
  studentId: string,
  videoId: string,
  input: StudentVideoFormInput
): Promise<VideoActionResult> {
  if (!isUuid(studentId) || !isUuid(videoId))
    return { ok: false, error: "Invalid input" };
  const v = parseVideoInput(input);
  if (!v.ok) return v;
  const auth = await authorize(studentId);
  if (!auth.ok) return auth;

  const [row] = await db
    .update(studentVideos)
    .set(v.data)
    .where(
      and(eq(studentVideos.id, videoId), eq(studentVideos.studentId, studentId))
    )
    .returning();
  if (!row) return { ok: false, error: "Not found" };
  refresh(studentId);
  return { ok: true, video: toVideoItem(row) };
}

export async function deleteStudentVideo(
  studentId: string,
  videoId: string
): Promise<{ ok: true } | Failure> {
  if (!isUuid(studentId) || !isUuid(videoId))
    return { ok: false, error: "Invalid input" };
  const auth = await authorize(studentId);
  if (!auth.ok) return auth;

  const deleted = await db
    .delete(studentVideos)
    .where(
      and(eq(studentVideos.id, videoId), eq(studentVideos.studentId, studentId))
    )
    .returning({ id: studentVideos.id });
  if (deleted.length === 0) return { ok: false, error: "Not found" };
  refresh(studentId);
  return { ok: true };
}
