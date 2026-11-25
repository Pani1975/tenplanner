import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ExternalLink, UserRound } from "lucide-react";
import { db } from "@/db";
import { users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { FamilyHeader } from "@/components/family/family-header";
import { PlayerProfileForm } from "@/components/players/player-profile-form";
import { getPlayerProfile } from "@/lib/players/server";

export const metadata = { title: "Mi perfil de jugador" };

/** Separa "Nombre Apellido1 Apellido2" para rellenar un perfil nuevo. */
function splitName(full: string) {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

export default async function PerfilJugadorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [profile, [account]] = await Promise.all([
    getPlayerProfile(user.id),
    db
      .select({ name: users.name, image: users.image })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1),
  ]);
  const fallback = splitName(account?.name ?? "");

  return (
    <div className="tp-page">
      <div className="tp-page-pad mx-auto max-w-3xl space-y-6">
        <FamilyHeader
          icon={UserRound}
          kicker="Jugador"
          title="Mi perfil"
          description="Tu perfil de jugador. Es independiente de tu ficha en el club y solo es público si tú lo activas."
        />
        {profile?.isPublic && profile.slug && (
          <Link
            href={`/j/${profile.slug}`}
            target="_blank"
            className="inline-flex min-h-10 items-center gap-1 text-sm font-semibold text-brand-ink hover:underline"
          >
            Ver mi perfil público
            <ExternalLink className="size-3.5" />
          </Link>
        )}
        <PlayerProfileForm
          photoUrl={account?.image ?? null}
          initial={{
            firstName: profile?.firstName ?? fallback.first,
            lastName: profile?.lastName ?? fallback.last,
            birthDate: profile?.birthDate ?? "",
            showPhoto: profile?.showPhoto ?? false,
            clubName: profile?.clubName ?? "",
            dominantHand: profile?.dominantHand ?? "",
            startedAge: profile?.startedAge != null ? String(profile.startedAge) : "",
            favoritePlayer: profile?.favoritePlayer ?? "",
            birthPlace: profile?.birthPlace ?? "",
            isPublic: profile?.isPublic ?? false,
          }}
        />
      </div>
    </div>
  );
}
