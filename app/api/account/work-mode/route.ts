import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getActiveWorkClubId,
  getClubOptionsForUser,
  setActiveWorkClub,
} from "@/lib/clubs";

const bodySchema = z.object({
  clubId: z.string().uuid().nullable(),
});

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [activeClubId, options] = await Promise.all([
    getActiveWorkClubId(user.id),
    getClubOptionsForUser(user.id),
  ]);

  return NextResponse.json({ data: { activeClubId, options } });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );

  try {
    await setActiveWorkClub(user.id, parsed.data.clubId);
  } catch {
    return NextResponse.json(
      { error: "No perteneces a ese club." },
      { status: 403 }
    );
  }

  return NextResponse.json({
    ok: true,
    data: { activeClubId: parsed.data.clubId },
  });
}
