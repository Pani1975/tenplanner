import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { clubCoachProfiles } from "@/db/schema";
import { requireClubOwner } from "@/lib/club-owner-auth";
import {
  isUniqueViolation,
  newProfileLink,
  profileColumns,
  toCoachProfileView,
} from "@/lib/club-coach-profiles";
import {
  COACH_PROFILE_LINK_EXPIRY_DAYS,
  coachProfileLinkRequestSchema,
  coachProfileSchema,
} from "@/lib/coach-profile";
import { buildCoachProfileEmail } from "@/lib/coach-profile-email";
import { getSiteUrl, sendEmail } from "@/lib/email";
import { rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";

const bodySchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("direct"), profile: coachProfileSchema }),
  z.object({
    mode: z.literal("link"),
    ...coachProfileLinkRequestSchema.shape,
  }),
]);

const DUPLICATE = {
  error:
    "Ya hay una ficha de un monitor con ese email. Búscala en la lista para editarla o reenviarle el enlace.",
};

/**
 * El gestor crea una ficha de monitor: o la rellena él directamente
 * (`mode: "direct"`) o la crea pendiente y envía al monitor un enlace para
 * que la rellene él (`mode: "link"`, solo nombre y email).
 */
export async function POST(request: Request) {
  const auth = await requireClubOwner();
  if (!auth.ok) return auth.response;
  const { user, club } = auth;

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

  const email =
    parsed.data.mode === "direct"
      ? parsed.data.profile.email
      : parsed.data.email;
  const [existing] = await db
    .select({ id: clubCoachProfiles.id })
    .from(clubCoachProfiles)
    .where(
      and(
        eq(clubCoachProfiles.clubId, club.id),
        eq(clubCoachProfiles.email, email)
      )
    )
    .limit(1);
  if (existing) return NextResponse.json(DUPLICATE, { status: 409 });

  if (parsed.data.mode === "direct") {
    try {
      const [row] = await db
        .insert(clubCoachProfiles)
        .values({
          clubId: club.id,
          ...profileColumns(parsed.data.profile),
          status: "complete",
        })
        .returning();
      return NextResponse.json(
        { data: toCoachProfileView(row) },
        { status: 201 }
      );
    } catch (error) {
      if (isUniqueViolation(error))
        return NextResponse.json(DUPLICATE, { status: 409 });
      throw error;
    }
  }

  // Cada ficha por enlace envía un correo: limitamos para que no sea spam.
  const limit = await rateLimit(`club-profile-links:${user.id}`, 30, 3_600_000);
  if (!limit.ok) return tooManyRequestsResponse(limit);

  let row;
  try {
    [row] = await db
      .insert(clubCoachProfiles)
      .values({
        clubId: club.id,
        fullName: parsed.data.fullName,
        email,
        status: "pending",
        ...newProfileLink(),
      })
      .returning();
  } catch (error) {
    if (isUniqueViolation(error))
      return NextResponse.json(DUPLICATE, { status: 409 });
    throw error;
  }

  const emailResult = await sendEmail(
    buildCoachProfileEmail({
      to: row.email,
      recipientName: row.fullName,
      clubName: club.name,
      profileUrl: `${getSiteUrl(request.url)}/ficha-monitor/${row.profileToken}`,
      expiryDays: COACH_PROFILE_LINK_EXPIRY_DAYS,
      replyTo: user.email ?? undefined,
    })
  );
  return NextResponse.json(
    { data: toCoachProfileView(row), emailSent: emailResult.sent },
    { status: 201 }
  );
}
