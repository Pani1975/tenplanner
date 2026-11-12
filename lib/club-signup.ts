// Alta de un club desde los datos del registro ("Crear cuenta de club").
//
// Al registrarse con correo, los datos del club se guardan en los metadatos
// de la cuenta (club_name, club_seats, club_address, …) y el club se crea
// cuando la persona confirma el correo (/auth/callback). Pero si abre el
// enlace en otro dispositivo, la sesión no se puede completar ahí y el club
// no se crea (la cuenta queda confirmada, sin club ni Modo gestión). Por eso
// la misma creación se repite al entrar con contraseña: es idempotente.

import { db } from "@/db";
import { clubMembers, clubs, users } from "@/db/schema";
import { cleanOptionalText, normalizeWebsite } from "@/lib/club-identity";
import { getOwnedClub } from "@/lib/clubs";

export type SignupUser = {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

function metaText(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/** Valores del club a partir de los metadatos del alta, o null si no era un alta de club. */
export function clubValuesFromSignup(
  metadata: Record<string, unknown> | null | undefined,
  email: string | null | undefined
) {
  const clubName = metadata?.club_name;
  if (typeof clubName !== "string" || clubName.trim().length < 2) return null;
  const seatsRaw = metadata?.club_seats;
  const seats =
    typeof seatsRaw === "string" && seatsRaw.trim() ? Number(seatsRaw) : null;
  return {
    name: clubName.trim(),
    plannedCoachSeats: seats !== null && Number.isFinite(seats) ? seats : null,
    address: cleanOptionalText(metaText(metadata?.club_address), 500),
    phone: cleanOptionalText(metaText(metadata?.club_phone), 50),
    website: normalizeWebsite(metaText(metadata?.club_website)),
    // Email del club: el de la cuenta (editable en Mi club).
    email: email?.toLowerCase() ?? null,
  };
}

/**
 * Crea el club de un alta "Como club" si la cuenta aún no tiene uno. Devuelve
 * true si lo ha creado. Se puede llamar las veces que haga falta.
 */
export async function createClubFromSignup(user: SignupUser): Promise<boolean> {
  const values = clubValuesFromSignup(user.user_metadata, user.email);
  if (!values) return false;
  if (await getOwnedClub(user.id)) return false;
  await db.transaction(async (tx) => {
    const [club] = await tx
      .insert(clubs)
      .values({ ...values, ownerId: user.id })
      .returning();
    await tx.insert(clubMembers).values({
      clubId: club.id,
      userId: user.id,
      role: "owner",
      status: "active",
    });
  });
  return true;
}

/**
 * Deja lista la cuenta tras confirmar el correo o entrar: su fila en users
 * y, si se registró como club, su club. No falla: si algo sale mal se anota
 * en el registro y la persona entra igualmente.
 */
export async function ensureAccountFromSignup(user: SignupUser) {
  try {
    if (user.email) {
      await db
        .insert(users)
        .values({
          id: user.id,
          name:
            (typeof user.user_metadata?.full_name === "string"
              ? user.user_metadata.full_name
              : null) ??
            user.email ??
            "User",
          email: user.email,
          image:
            typeof user.user_metadata?.avatar_url === "string"
              ? user.user_metadata.avatar_url
              : null,
        })
        .onConflictDoNothing();
    }
    await createClubFromSignup(user);
  } catch (error) {
    console.error("Error preparing account from signup", {
      userId: user.id,
      error,
    });
  }
}
