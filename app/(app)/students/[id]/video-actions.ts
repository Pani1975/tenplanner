"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { students, studentVideos } from "@/db/schema";
import {
  canTagWithClub,
  getActiveWorkClubId,
  sharedWithClubCondition,
} from "@/lib/clubs";
import { createClient } from "@/lib/supabase/server";
import { normalizeVideoUrl } from "@/lib/video-embed";
import type { StudentVideoItem } from "./student-videos-panel";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuid = z.string().regex(UUID_RE);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const videoSchema = z.object({
  location: optionalText(200),
  event: optionalText(200),
  recordedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  notes: optionalText(2000),
  videoUrl: z.string().trim().min(1).max(2000),
});

export type StudentVideoInput = z.input<typeof videoSchema>;

type Failure = { ok: false; error: string };
type Result = { ok: true; video: StudentVideoItem } | Failure;

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

function parse(input: StudentVideoInput) {
  const parsed = videoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Revisa los datos de la ficha." };
  }
  const link = normalizeVideoUrl(parsed.data.videoUrl);
  if (!link) {
    return {
      ok: false as const,
      error: "El enlace no es válido. Pega la dirección completa del vídeo.",
    };
  }
  return { ok: true as const, data: { ...parsed.data, videoUrl: link.url } };
}

function toItem(row: typeof studentVideos.$inferSelect): StudentVideoItem {
  return {
    id: row.id,
    location: row.location,
    event: row.event,
    recordedOn: row.recordedOn,
    notes: row.notes,
    videoUrl: row.videoUrl,
  };
}

export async function createStudentVideo(
  studentId: string,
  input: StudentVideoInput
): Promise<Result> {
  if (!uuid.safeParse(studentId).success)
    return { ok: false, error: "Invalid input" };
  const v = parse(input);
  if (!v.ok) return v;
  const auth = await authorize(studentId);
  if (!auth.ok) return auth;

  const [row] = await db
    .insert(studentVideos)
    .values({ studentId, createdBy: auth.userId, ...v.data })
    .returning();
  revalidatePath(`/students/${studentId}`);
  return { ok: true, video: toItem(row) };
}

export async function updateStudentVideo(
  studentId: string,
  videoId: string,
  input: StudentVideoInput
): Promise<Result> {
  if (!uuid.safeParse(studentId).success || !uuid.safeParse(videoId).success)
    return { ok: false, error: "Invalid input" };
  const v = parse(input);
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
  revalidatePath(`/students/${studentId}`);
  return { ok: true, video: toItem(row) };
}

export async function deleteStudentVideo(
  studentId: string,
  videoId: string
): Promise<{ ok: true } | Failure> {
  if (!uuid.safeParse(studentId).success || !uuid.safeParse(videoId).success)
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
  revalidatePath(`/students/${studentId}`);
  return { ok: true };
}
