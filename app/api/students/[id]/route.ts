import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { students } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { geocodeLocality } from "@/lib/geo/geocode";
import {
  studentIdParamsSchema,
  updateStudentSchema,
  zodValidationErrorResponse,
} from "../validation";

function internalServerError() {
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}

function notFoundResponse() {
  return NextResponse.json({ error: "Student not found" }, { status: 404 });
}

type StudentRouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: StudentRouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await context.params;
  const parsed = studentIdParamsSchema.safeParse(params);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  try {
    const activeClubId = await getActiveWorkClubId(user.id);
    const [row] = await db
      .select()
      .from(students)
      .where(
        and(
          eq(students.id, parsed.data.id),
          sharedWithClubCondition(
            students.coachId,
            students.clubId,
            user.id,
            activeClubId
          )
        )
      )
      .limit(1);

    if (!row) return notFoundResponse();
    return NextResponse.json({ data: row });
  } catch {
    return internalServerError();
  }
}

export async function PUT(request: Request, context: StudentRouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await context.params;
  const parsed = studentIdParamsSchema.safeParse(params);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsedBody = updateStudentSchema.safeParse(body);
  if (!parsedBody.success) return zodValidationErrorResponse(parsedBody.error);

  try {
    const [existing] = await db
      .select({
        id: students.id,
        locality: students.locality,
        localityLat: students.localityLat,
      })
      .from(students)
      .where(
        and(eq(students.id, parsed.data.id), eq(students.coachId, user.id))
      )
      .limit(1);
    if (!existing) return notFoundResponse();

    const d = parsedBody.data;

    const updateValues: Record<string, unknown> = {};

    const fields = [
      "name",
      "gender",
      "birthDate",
      "heightCm",
      "weightKg",
      "dominantHand",
      "playerLevel",
      "yearsExperience",
      "yearStartedTennis",
      "yearStartedRacketSports",
      "preferredSchedule",
      "notes",
      "imageUrl",
    ] as const;

    for (const field of fields) {
      if (d[field] !== undefined) {
        updateValues[field] = d[field];
      }
    }

    if (d.email !== undefined) {
      updateValues.email = d.email === "" ? null : d.email;
    }
    if (d.phone !== undefined) {
      updateValues.phone = d.phone === "" ? null : d.phone;
    }
    if (d.locality !== undefined) {
      const locality = d.locality ? d.locality : null;
      updateValues.locality = locality;
      if (!locality) {
        updateValues.localityLat = null;
        updateValues.localityLng = null;
      } else if (
        locality !== existing.locality ||
        existing.localityLat === null
      ) {
        const geo = await geocodeLocality(locality);
        updateValues.localityLat = geo?.lat ?? null;
        updateValues.localityLng = geo?.lng ?? null;
      }
    }
    if (
      d.yearStartedRacketSports !== undefined &&
      d.yearStartedTennis === undefined
    ) {
      updateValues.yearStartedTennis = d.yearStartedRacketSports;
    }
    if (
      d.yearStartedTennis !== undefined &&
      d.yearStartedRacketSports === undefined
    ) {
      updateValues.yearStartedRacketSports = d.yearStartedTennis;
    }

    const [updated] = await db
      .update(students)
      .set(updateValues)
      .where(
        and(eq(students.id, parsed.data.id), eq(students.coachId, user.id))
      )
      .returning();

    if (!updated) return notFoundResponse();
    return NextResponse.json({ data: updated });
  } catch {
    return internalServerError();
  }
}

const AVATARS_BUCKET = "avatars";

function extractStoragePath(
  publicUrl: string | null,
  bucket: string
): string | null {
  if (!publicUrl) return null;
  const marker = `/storage/v1/object/public/${bucket}/`;
  const idx = publicUrl.indexOf(marker);
  if (idx === -1) return null;
  return publicUrl.slice(idx + marker.length);
}

export async function DELETE(_request: Request, context: StudentRouteContext) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const params = await context.params;
  const parsed = studentIdParamsSchema.safeParse(params);
  if (!parsed.success) return zodValidationErrorResponse(parsed.error);

  try {
    const [existing] = await db
      .select({ id: students.id, imageUrl: students.imageUrl })
      .from(students)
      .where(
        and(eq(students.id, parsed.data.id), eq(students.coachId, user.id))
      )
      .limit(1);
    if (!existing) return notFoundResponse();

    const [deleted] = await db
      .delete(students)
      .where(
        and(eq(students.id, parsed.data.id), eq(students.coachId, user.id))
      )
      .returning({ id: students.id });

    if (!deleted) return notFoundResponse();

    const path = extractStoragePath(existing.imageUrl, AVATARS_BUCKET);
    if (path) {
      await supabase.storage.from(AVATARS_BUCKET).remove([path]);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return internalServerError();
  }
}
