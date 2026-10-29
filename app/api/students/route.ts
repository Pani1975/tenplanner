import { asc } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { students, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { geocodeLocality } from "@/lib/geo/geocode";
import { createStudentSchema, zodValidationErrorResponse } from "./validation";

function internalServerError() {
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

async function ensureUser(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  if (!user.email) return;
  const metadataName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : user.email;
  await db
    .insert(users)
    .values({ id: user.id, name: metadataName, email: user.email })
    .onConflictDoNothing();
}

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const activeClubId = await getActiveWorkClubId(user.id);
    const rows = await db
      .select()
      .from(students)
      .where(
        sharedWithClubCondition(
          students.coachId,
          students.clubId,
          user.id,
          activeClubId
        )
      )
      .orderBy(asc(students.name));

    return NextResponse.json({ data: rows });
  } catch {
    return internalServerError();
  }
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

  const parsed = createStudentSchema.safeParse(body);
  if (!parsed.success) {
    return zodValidationErrorResponse(parsed.error);
  }

  const d = parsed.data;

  try {
    await ensureUser(user);

    // El club ya no se elige por elemento: se etiqueta automáticamente con
    // el modo de trabajo activo del usuario (ver /api/account/work-mode).
    const clubId = await getActiveWorkClubId(user.id);

    const locality = d.locality ? d.locality : null;
    const geo = locality ? await geocodeLocality(locality) : null;

    const [created] = await db
      .insert(students)
      .values({
        coachId: user.id,
        name: d.name,
        email: d.email ? d.email : null,
        gender: d.gender ?? null,
        birthDate: d.birthDate ?? null,
        heightCm: d.heightCm ?? null,
        weightKg: d.weightKg ?? null,
        dominantHand: d.dominantHand ?? null,
        playerLevel: d.playerLevel ?? null,
        yearsExperience: d.yearsExperience ?? null,
        yearStartedTennis:
          d.yearStartedTennis ?? d.yearStartedRacketSports ?? null,
        yearStartedRacketSports:
          d.yearStartedRacketSports ?? d.yearStartedTennis ?? null,
        phone: d.phone ? d.phone : null,
        preferredSchedule: d.preferredSchedule ?? null,
        locality,
        localityLat: geo?.lat ?? null,
        localityLng: geo?.lng ?? null,
        notes: d.notes ?? null,
        imageUrl: d.imageUrl ?? null,
        clubId,
      })
      .returning();

    return NextResponse.json({ data: created }, { status: 201 });
  } catch {
    return internalServerError();
  }
}
