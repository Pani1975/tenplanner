import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getOwnedClub } from "@/lib/clubs";

type OwnedClub = NonNullable<Awaited<ReturnType<typeof getOwnedClub>>>;

/**
 * Para las rutas del gestor: exige sesión y que la cuenta sea dueña de un
 * club. Si no, devuelve la respuesta de error lista para devolver.
 */
export async function requireClubOwner(): Promise<
  | { ok: true; user: User; club: OwnedClub }
  | { ok: false; response: NextResponse }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const club = await getOwnedClub(user.id);
  if (!club) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Solo el gestor del club puede hacer esto." },
        { status: 403 }
      ),
    };
  }
  return { ok: true, user, club };
}
