import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { clubMembers, clubs } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  cleanOptionalText,
  clubIdentitySchema,
  normalizeCourts,
  normalizeWebsite,
} from "@/lib/club-identity";

type Ctx = { params: Promise<{ id: string }> };

// Ficha del club ("Mi club"): nombre (el de las cabeceras), contacto, fotos,
// vídeos, instalaciones y año de fundación. La edita el propietario del club.
export async function PATCH(request: Request, ctx: Ctx) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  if (!z.string().uuid().safeParse(id).success)
    return NextResponse.json({ error: "Invalid club id" }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = clubIdentitySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ?? "Revisa los datos de la ficha.",
      },
      { status: 422 }
    );

  const [owner] = await db
    .select({ id: clubMembers.id })
    .from(clubMembers)
    .where(
      and(
        eq(clubMembers.clubId, id),
        eq(clubMembers.userId, user.id),
        eq(clubMembers.role, "owner"),
        eq(clubMembers.status, "active")
      )
    )
    .limit(1);
  if (!owner)
    return NextResponse.json(
      { error: "Solo el propietario del club puede editar su ficha." },
      { status: 403 }
    );

  const d = parsed.data;
  await db
    .update(clubs)
    .set({
      name: d.name,
      fullName: d.fullName || null,
      address: d.address || null,
      phone: cleanOptionalText(d.phone, 50),
      email: d.email.toLowerCase(),
      website: normalizeWebsite(d.website),
      coverImageUrl: d.coverImageUrl || null,
      photos: d.photos.length > 0 ? d.photos : null,
      videos: d.videos.length > 0 ? d.videos : null,
      courts: normalizeCourts(d.courts),
      padelCourts: d.padelCourts || null,
      hasCafeteria: d.hasCafeteria,
      hasParking: d.hasParking,
      foundedYear: d.foundedYear,
    })
    .where(eq(clubs.id, id));

  return NextResponse.json({ ok: true });
}
