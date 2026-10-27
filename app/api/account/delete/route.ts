import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  users as usersTable,
  exercises as exercisesTable,
  students as studentsTable,
  sessions as sessionsTable,
  sessionBlocks as sessionBlocksTable,
  sessionBlockItems as sessionBlockItemsTable,
} from "@/db/schema";
import { removeSessionAudio } from "@/lib/session-audio";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const AVATARS_BUCKET = "avatars";
const EXERCISE_MEDIA_BUCKET = "exercise-media";

function parsePathFromPublicUrl(
  publicUrl: string | null,
  bucket: string
): string | null {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { confirm } = (body ?? {}) as { confirm?: string };
  if (confirm !== "ELIMINAR") {
    return NextResponse.json(
      { error: "Confirmación inválida." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  const avatarPaths: string[] = [];
  try {
    const { data: files } = await admin.storage
      .from(AVATARS_BUCKET)
      .list("", { search: user.id });
    if (files) {
      for (const f of files) {
        if (f.name.startsWith(user.id)) avatarPaths.push(f.name);
      }
    }
  } catch {
    // bucket listing is best-effort
  }
  if (avatarPaths.length > 0) {
    await admin.storage.from(AVATARS_BUCKET).remove(avatarPaths);
  }

  const userExercises = await db
    .select({ id: exercisesTable.id, imageUrl: exercisesTable.imageUrl })
    .from(exercisesTable)
    .where(eq(exercisesTable.createdBy, user.id));

  const exerciseMediaPaths: string[] = [];
  for (const ex of userExercises) {
    const path = parsePathFromPublicUrl(ex.imageUrl, EXERCISE_MEDIA_BUCKET);
    if (path) exerciseMediaPaths.push(path);
  }
  if (exerciseMediaPaths.length > 0) {
    await admin.storage.from(EXERCISE_MEDIA_BUCKET).remove(exerciseMediaPaths);
  }

  const userStudents = await db
    .select({ id: studentsTable.id, imageUrl: studentsTable.imageUrl })
    .from(studentsTable)
    .where(eq(studentsTable.coachId, user.id));
  const studentAvatarPaths: string[] = [];
  for (const s of userStudents) {
    const path = parsePathFromPublicUrl(s.imageUrl, AVATARS_BUCKET);
    if (path) studentAvatarPaths.push(path);
  }
  if (studentAvatarPaths.length > 0) {
    await admin.storage.from(AVATARS_BUCKET).remove(studentAvatarPaths);
  }

  // Notas de voz de sus sesiones (bucket privado): se borran con la cuenta.
  const sessionAudioRows = await db
    .select({ path: sessionsTable.coachAudioPath })
    .from(sessionsTable)
    .where(eq(sessionsTable.userId, user.id));
  const itemAudioRows = await db
    .select({ path: sessionBlockItemsTable.coachAudioPath })
    .from(sessionBlockItemsTable)
    .innerJoin(
      sessionBlocksTable,
      eq(sessionBlocksTable.id, sessionBlockItemsTable.blockId)
    )
    .innerJoin(
      sessionsTable,
      eq(sessionsTable.id, sessionBlocksTable.sessionId)
    )
    .where(eq(sessionsTable.userId, user.id));
  await removeSessionAudio([
    ...sessionAudioRows.map((row) => row.path),
    ...itemAudioRows.map((row) => row.path),
  ]);

  await db.delete(usersTable).where(eq(usersTable.id, user.id));

  const { error: authError } = await admin.auth.admin.deleteUser(user.id);
  if (authError) {
    return NextResponse.json(
      { error: "No se pudo eliminar la cuenta de autenticación." },
      { status: 500 }
    );
  }

  await supabase.auth.signOut();

  return NextResponse.json({ ok: true });
}
