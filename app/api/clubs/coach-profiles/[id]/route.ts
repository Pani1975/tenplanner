import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clubCoachProfiles } from "@/db/schema";
import { requireClubOwner } from "@/lib/club-owner-auth";
import {
  getClubCoachProfile,
  isUniqueViolation,
  profileColumns,
  toCoachProfileView,
} from "@/lib/club-coach-profiles";
import { coachProfileSchema } from "@/lib/coach-profile";

type Ctx = { params: Promise<{ id: string }> };

const bodySchema = z.object({ profile: coachProfileSchema });

/** El gestor rellena o corrige la ficha directamente. */
export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireClubOwner();
  if (!auth.ok) return auth.response;
  const { club } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues[0]?.message ?? "Datos no válidos.",
        fieldErrors: Object.fromEntries(
          parsed.error.issues.map((i) => [i.path.join("."), i.message])
        ),
      },
      { status: 422 }
    );
  }

  const current = await getClubCoachProfile(club.id, id);
  if (!current) {
    return NextResponse.json(
      { error: "Ficha no encontrada." },
      { status: 404 }
    );
  }

  try {
    const [row] = await db
      .update(clubCoachProfiles)
      .set({
        ...profileColumns(parsed.data.profile),
        status: "complete",
        // Rellenada por el gestor: el enlace pendiente ya no hace falta.
        profileToken: null,
        profileTokenExpiresAt: null,
      })
      .where(
        and(eq(clubCoachProfiles.id, id), eq(clubCoachProfiles.clubId, club.id))
      )
      .returning();
    return NextResponse.json({ data: toCoachProfileView(row) });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json(
        { error: "Ya hay otra ficha con ese email en el club." },
        { status: 409 }
      );
    }
    throw error;
  }
}

export async function DELETE(_request: Request, { params }: Ctx) {
  const { id } = await params;
  const auth = await requireClubOwner();
  if (!auth.ok) return auth.response;

  const [deleted] = await db
    .delete(clubCoachProfiles)
    .where(
      and(
        eq(clubCoachProfiles.id, id),
        eq(clubCoachProfiles.clubId, auth.club.id)
      )
    )
    .returning({ id: clubCoachProfiles.id });
  if (!deleted) {
    return NextResponse.json(
      { error: "Ficha no encontrada." },
      { status: 404 }
    );
  }
  return NextResponse.json({ ok: true });
}
