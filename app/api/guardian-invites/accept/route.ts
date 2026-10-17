import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { GuardianError, acceptGuardianInvite } from "@/lib/guardians";

const bodySchema = z.object({
  token: z.string().min(10).max(200),
  consent: z.literal(true),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Tienes que aceptar las condiciones para continuar." },
      { status: 400 }
    );
  }

  try {
    const data = await acceptGuardianInvite(
      { id: user.id, email: user.email },
      parsed.data.token
    );
    return NextResponse.json({ data });
  } catch (error) {
    if (error instanceof GuardianError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error("[guardian-invites] accept failed", error);
    return NextResponse.json(
      { error: "No se pudo aceptar la invitación." },
      { status: 500 }
    );
  }
}
