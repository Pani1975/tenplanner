import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { clubMembers, clubs } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import {
  canUserCreateClub,
  getOwnedClub,
  getCoachMemberships,
} from "@/lib/clubs";

const createSchema = z.object({
  name: z.string().trim().min(2).max(255),
  plannedCoachSeats: z.number().int().min(0).max(999).optional().nullable(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [ownedClub, coachOf] = await Promise.all([
    getOwnedClub(user.id),
    getCoachMemberships(user.id),
  ]);

  return NextResponse.json({
    data: {
      ownedClub,
      coachOf: coachOf.map(({ club }) => club),
    },
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // Right after signUp() the session cookie isn't set yet, so also accept a
  // Bearer token from the freshly-created client session (see app/api/users).
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  const {
    data: { user },
  } = bearerToken
    ? await supabase.auth.getUser(bearerToken)
    : await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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

  const existing = await getOwnedClub(user.id);
  if (existing) {
    return NextResponse.json(
      { error: "Ya tienes un club registrado.", data: existing },
      { status: 409 }
    );
  }
  if (!(await canUserCreateClub(user.id, user.user_metadata))) {
    return NextResponse.json(
      {
        error:
          "Un club se da de alta con su propia cuenta: crea una cuenta nueva eligiendo «Como Club».",
      },
      { status: 403 }
    );
  }

  const club = await db.transaction(async (tx) => {
    const [club] = await tx
      .insert(clubs)
      .values({
        name: parsed.data.name,
        ownerId: user.id,
        plannedCoachSeats: parsed.data.plannedCoachSeats ?? null,
      })
      .returning();

    await tx.insert(clubMembers).values({
      clubId: club.id,
      userId: user.id,
      role: "owner",
      status: "active",
    });

    return club;
  });

  return NextResponse.json({ data: club }, { status: 201 });
}
