import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureBookingToken } from "@/lib/bookings/server";

// Enlace público para reservar las pistas del usuario (se crea una vez).
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = await ensureBookingToken(user.id);
  return NextResponse.json({ data: { token, path: `/reservar/${token}` } });
}
