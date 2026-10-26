import { NextResponse } from "next/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { clubInvites, clubMembers, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  getOwnedClub,
  generateInviteToken,
  inviteExpiryDate,
  listClubRoster,
  CLUB_INVITE_EXPIRY_DAYS,
} from "@/lib/clubs";
import { sendEmail } from "@/lib/email";
import { buildClubInviteEmail } from "@/lib/club-invite-email";
import { rateLimit, tooManyRequestsResponse } from "@/lib/rate-limit";
import { SPORT_LABELS } from "@/lib/sport-constants";
import { getActiveSport, SPORTS } from "@/lib/sports";

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  name: z.string().trim().max(255).optional(),
  sport: z.enum(SPORTS).optional(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const club = await getOwnedClub(user.id);
  if (!club) {
    return NextResponse.json({ error: "No tienes un club." }, { status: 403 });
  }

  const { members, invites } = await listClubRoster(club.id);

  return NextResponse.json({ data: { club, members, invites } });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const club = await getOwnedClub(user.id);
  if (!club) {
    return NextResponse.json({ error: "No tienes un club." }, { status: 403 });
  }

  // Cada invitación envía un correo: limitamos para que no se use de spam.
  const limit = await rateLimit(`club-invites:${user.id}`, 30, 60 * 60_000);
  if (!limit.ok) return tooManyRequestsResponse(limit);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const email = parsed.data.email;
  const inviteeName = parsed.data.name || null;
  // Por defecto, el deporte activo del dueño del club — así el formulario
  // puede omitirlo y seguir invitando "para lo que estoy viendo ahora".
  const sport = parsed.data.sport ?? (await getActiveSport(user.id));

  // Already an active coach in this club, for this sport?
  const [existingMember] = await db
    .select({ id: clubMembers.id })
    .from(clubMembers)
    .innerJoin(users, eq(users.id, clubMembers.userId))
    .where(
      and(
        eq(clubMembers.clubId, club.id),
        eq(clubMembers.status, "active"),
        eq(clubMembers.sport, sport),
        eq(users.email, email)
      )
    )
    .limit(1);
  if (existingMember) {
    return NextResponse.json(
      { error: "Ese monitor ya está vinculado al club para ese deporte." },
      { status: 409 }
    );
  }

  // Refresh an existing pending invite (same club+email+sport) instead of
  // piling up duplicates — a different sport gets its own invite.
  const [existingInvite] = await db
    .select()
    .from(clubInvites)
    .where(
      and(
        eq(clubInvites.clubId, club.id),
        eq(clubInvites.email, email),
        eq(clubInvites.sport, sport),
        eq(clubInvites.status, "pending")
      )
    )
    .limit(1);

  const token = generateInviteToken();
  const expiresAt = inviteExpiryDate();

  const [invite] = existingInvite
    ? await db
        .update(clubInvites)
        .set({
          token,
          expiresAt,
          ...(inviteeName ? { inviteeName } : {}),
        })
        .where(eq(clubInvites.id, existingInvite.id))
        .returning()
    : await db
        .insert(clubInvites)
        .values({
          clubId: club.id,
          email,
          inviteeName,
          sport,
          token,
          invitedByUserId: user.id,
          expiresAt,
        })
        .returning();

  const siteUrl = (
    process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin
  ).replace(/\/$/, "");
  const emailResult = await sendEmail(
    buildClubInviteEmail({
      to: email,
      inviteeName: invite.inviteeName,
      clubName: club.name,
      sportLabel: SPORT_LABELS[sport],
      inviteUrl: `${siteUrl}/invite/${invite.token}`,
      expiryDays: CLUB_INVITE_EXPIRY_DAYS,
      replyTo: user.email ?? undefined,
    })
  );

  return NextResponse.json(
    { data: invite, emailSent: emailResult.sent },
    { status: 201 }
  );
}
