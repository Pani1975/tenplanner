"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { clubCoachProfiles } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getOwnCoachProfiles, profileColumns } from "@/lib/club-coach-profiles";
import { coachProfileSchema } from "@/lib/coach-profile";
import type { CoachProfileSubmitResult } from "@/components/app/coach-profile-form";

/**
 * El monitor guarda su ficha desde su Perfil. Es la misma ficha para todos
 * los clubes de los que es monitor: se guarda (o se crea) en cada uno, con su
 * email de la cuenta, y el gestor la ve en Gestión → Monitores sin poder
 * cambiarla.
 */
export async function saveOwnCoachProfile(
  data: unknown,
  consent: boolean
): Promise<CoachProfileSubmitResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Inicia sesión de nuevo." };

  if (consent !== true) {
    return {
      ok: false,
      error: "Debes aceptar el tratamiento de tus datos para continuar.",
    };
  }

  const email = user.email.toLowerCase();
  const parsed = coachProfileSchema.safeParse({
    ...(data && typeof data === "object" ? data : {}),
    email,
  });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Revisa los datos.",
      fieldErrors: Object.fromEntries(
        parsed.error.issues
          .reverse()
          .map((issue) => [issue.path.join("."), issue.message])
      ),
    };
  }

  const { clubIds } = await getOwnCoachProfiles(user.id, email);
  if (clubIds.length === 0) {
    return { ok: false, error: "No perteneces a ningún club." };
  }

  const values = {
    ...profileColumns(parsed.data),
    email,
    status: "complete",
    consentGivenAt: new Date(),
    profileToken: null,
    profileTokenExpiresAt: null,
  };
  for (const clubId of clubIds) {
    await db
      .insert(clubCoachProfiles)
      .values({ ...values, clubId })
      .onConflictDoUpdate({
        target: [clubCoachProfiles.clubId, clubCoachProfiles.email],
        set: values,
      });
  }
  revalidatePath("/profile");
  return { ok: true };
}
