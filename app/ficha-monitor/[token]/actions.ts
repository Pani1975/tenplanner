"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { db } from "@/db";
import { clubCoachProfiles } from "@/db/schema";
import { profileColumns } from "@/lib/club-coach-profiles";
import { coachProfileSchema } from "@/lib/coach-profile";
import { getClientIp, rateLimit } from "@/lib/rate-limit";
import type { CoachProfileSubmitResult } from "@/components/app/coach-profile-form";

/**
 * El propio monitor envía su ficha desde el enlace. El enlace es de un solo
 * uso: al guardar la ficha deja de valer. El email no se puede cambiar: es el
 * del enlace.
 */
export async function submitCoachProfileByLink(
  token: string,
  data: unknown,
  consent: boolean
): Promise<CoachProfileSubmitResult> {
  const limit = await rateLimit(
    `coach-profile-link:${getClientIp(await headers())}`,
    20,
    15 * 60_000
  );
  if (!limit.ok) {
    return {
      ok: false,
      error: "Demasiados intentos. Prueba de nuevo en unos minutos.",
    };
  }

  if (typeof token !== "string" || token.length < 10 || token.length > 128) {
    return { ok: false, error: "Enlace inválido o caducado." };
  }

  const [profile] = await db
    .select({
      id: clubCoachProfiles.id,
      email: clubCoachProfiles.email,
      expiresAt: clubCoachProfiles.profileTokenExpiresAt,
    })
    .from(clubCoachProfiles)
    .where(eq(clubCoachProfiles.profileToken, token))
    .limit(1);
  if (!profile || !profile.expiresAt || profile.expiresAt < new Date()) {
    return {
      ok: false,
      error: "Este enlace ha caducado. Pide uno nuevo al club.",
    };
  }

  if (consent !== true) {
    return {
      ok: false,
      error: "Debes aceptar el tratamiento de tus datos para continuar.",
    };
  }

  const parsed = coachProfileSchema.safeParse({
    ...(data && typeof data === "object" ? data : {}),
    email: profile.email,
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

  // Condición sobre el token: si dos envíos coinciden, solo gana uno.
  const [saved] = await db
    .update(clubCoachProfiles)
    .set({
      ...profileColumns(parsed.data),
      status: "complete",
      consentGivenAt: new Date(),
      profileToken: null,
      profileTokenExpiresAt: null,
    })
    .where(
      and(
        eq(clubCoachProfiles.id, profile.id),
        eq(clubCoachProfiles.profileToken, token)
      )
    )
    .returning({ id: clubCoachProfiles.id });
  if (!saved) {
    return { ok: false, error: "Este enlace ya se ha usado." };
  }
  return { ok: true };
}
