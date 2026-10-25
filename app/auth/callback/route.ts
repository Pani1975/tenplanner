import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { clubMembers, clubs, users } from "@/db/schema";
import { getOwnedClub } from "@/lib/clubs";
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

        // Club sign-up that needed email confirmation: the club couldn't be
        // created at submit time (no users row yet), so finish it here.
        const clubName = user.user_metadata?.club_name;
        if (typeof clubName === "string" && clubName.trim().length >= 2) {
          try {
            const existing = await getOwnedClub(user.id);
            if (!existing) {
              const seatsRaw = user.user_metadata?.club_seats;
              const seats =
                typeof seatsRaw === "string" && seatsRaw.trim()
                  ? Number(seatsRaw)
                  : null;
              await db.transaction(async (tx) => {
                const [club] = await tx
                  .insert(clubs)
                  .values({
                    name: clubName.trim(),
                    ownerId: user.id,
                    plannedCoachSeats:
                      seats !== null && Number.isFinite(seats) ? seats : null,
                  })
                  .returning();
                await tx.insert(clubMembers).values({
                  clubId: club.id,
                  userId: user.id,
                  role: "owner",
                  status: "active",
                });
              });
            }
          } catch (error) {
            console.error("Error creating club during auth callback", {
              userId: user.id,
              error,
            });
          }
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
