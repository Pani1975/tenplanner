import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubCoachProfiles } from "@/db/schema";
import { requireClubOwner } from "@/lib/club-owner-auth";
import {
  getClubCoachProfile,
  newProfileLink,
  toCoachProfileView,
} from "@/lib/club-coach-profiles";
import { COACH_PROFILE_LINK_EXPIRY_DAYS } from "@/lib/coach-profile";
import { buildCoachProfileEmail } from "@/lib/coach-profile-email";
import { getSiteUrl, sendEmail } from "@/lib/email";
import { rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";

/**
 * Genera un enlace nuevo (el anterior deja de valer) y se lo envía por email
 * al monitor. Sirve para pedir la ficha, reenviarla o pedir que la actualice.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const auth = await requireClubOwner();
  if (!auth.ok) return auth.response;
  const { user, club } = auth;

  const current = await getClubCoachProfile(club.id, id);
  if (!current) {
    return NextResponse.json(
      { error: "Ficha no encontrada." },
      { status: 404 }
    );
  }

  const limit = await rateLimit(`club-profile-links:${user.id}`, 30, 3_600_000);
  if (!limit.ok) return tooManyRequestsResponse(limit);

  const [row] = await db
    .update(clubCoachProfiles)
    .set(newProfileLink())
    .where(
      and(eq(clubCoachProfiles.id, id), eq(clubCoachProfiles.clubId, club.id))
    )
    .returning();

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
  return NextResponse.json({
    data: toCoachProfileView(row),
    emailSent: emailResult.sent,
  });
}
