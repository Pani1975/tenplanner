import type { User } from "@supabase/supabase-js";
import type { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createClubFromSignup } from "@/lib/club-signup";
import { isFamilyAccountType } from "@/lib/family-account";
import { resetToDefaultWorkMode } from "@/lib/work-mode";

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;

/**
 * Devuelve una ruta relativa del mismo sitio. Cualquier otra cosa ("//…",
 * "/\…", una URL completa) se cambia por /dashboard para que un enlace no
 * pueda llevar al usuario a otra web.
 */
export function safeNext(raw: string | null, fallback = "/dashboard"): string {
  if (!raw) return fallback;
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

/**
 * Pasos comunes tras abrir una sesión (Google, enlace de confirmación o de
 * recuperación): fila en `users`, tipo de cuenta, club del alta y modo de
 * trabajo por defecto. Ningún fallo aquí bloquea al usuario: la sesión ya
 * está abierta.
 */
export async function finishSignIn(
  supabase: ServerSupabase,
  user: User,
  requestedAccountType: string | null,
  // Jugador que confirmó en /register que tiene 18 años o más.
  adultConfirmed = false
): Promise<void> {
  if (!user.email) return;

  try {
    const inserted = await db
      .insert(users)
      .values({
        id: user.id,
        name: user.user_metadata.full_name ?? user.email ?? "User",
        email: user.email,
        image: user.user_metadata.avatar_url ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: users.id });

    // Solo en un alta nueva: una cuenta que ya existía (p. ej. un monitor
    // que entra con Google) no cambia de tipo por este enlace.
    if (
      inserted.length > 0 &&
      isFamilyAccountType({ account_type: requestedAccountType })
    ) {
      await supabase.auth.updateUser({
        data: {
          account_type: requestedAccountType,
          ...(requestedAccountType === "jugador" && adultConfirmed
            ? { adult_confirmed_at: new Date().toISOString() }
            : {}),
        },
      });
    }
  } catch (error) {
    console.error("Error syncing user profile after sign-in", {
      userId: user.id,
      error,
    });
  }

  // Alta de club que necesitó confirmar el correo: el club no se pudo crear
  // al enviar el formulario (aún no había fila en users).
  try {
    await createClubFromSignup(user);
  } catch (error) {
    console.error("Error creating club after sign-in", {
      userId: user.id,
      error,
    });
  }

  // Cada inicio de sesión empieza en el modo por defecto de la cuenta.
  try {
    await resetToDefaultWorkMode(user.id);
  } catch (error) {
    console.error("Error resetting work mode after sign-in", {
      userId: user.id,
      error,
    });
  }
}
