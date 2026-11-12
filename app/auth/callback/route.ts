import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createClubFromSignup } from "@/lib/club-signup";
import { isFamilyAccountType } from "@/lib/family-account";
import { resetToDefaultWorkMode } from "@/lib/work-mode";

function safeNext(raw: string | null): string {
  const fallback = "/dashboard";
  if (!raw) return fallback;
  // Must be a same-origin relative path: starts with "/" but not "//" or "/\"
  if (!raw.startsWith("/")) return fallback;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return fallback;
  return raw;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  // Alta con Google como familia o jugador (viene de /register).
  const requestedAccountType = searchParams.get("account_type");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        if (!user.email) {
          return NextResponse.redirect(`${origin}/login?error=missing_email`);
        }
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

          // Solo en un alta nueva: una cuenta que ya existía (p. ej. un
          // monitor que entra con Google) no cambia de tipo por este enlace.
          if (
            inserted.length > 0 &&
            isFamilyAccountType({ account_type: requestedAccountType })
          ) {
            await supabase.auth.updateUser({
              data: { account_type: requestedAccountType },
            });
          }
        } catch (error) {
          // DB error shouldn't trap the user — session is already set
          console.error("Error syncing user profile during auth callback", {
            userId: user.id,
            error,
          });
        }

        // Alta de club que necesitó confirmar el correo: el club no se pudo
        // crear al enviar el formulario (aún no había fila en users).
        try {
          await createClubFromSignup(user);
        } catch (error) {
          console.error("Error creating club during auth callback", {
            userId: user.id,
            error,
          });
        }

        // Cada inicio de sesión empieza en el modo por defecto de la cuenta.
        try {
          await resetToDefaultWorkMode(user.id);
        } catch (error) {
          console.error("Error resetting work mode during auth callback", {
            userId: user.id,
            error,
          });
        }
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
