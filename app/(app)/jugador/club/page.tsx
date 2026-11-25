import { redirect } from "next/navigation";
import { Building2, Globe, Mail, MapPin, Phone } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FamilyHeader } from "@/components/family/family-header";
import { listPlayerClubs } from "@/lib/players/club";

export const metadata = { title: "Mi club" };

/** Clubes a los que está vinculado el jugador: solo datos de contacto del club. */
export default async function JugadorClubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const clubs = await listPlayerClubs(user.id).catch(() => []);

  return (
    <div className="tp-page">
      <div className="tp-page-pad mx-auto max-w-3xl space-y-6">
        <FamilyHeader
          icon={Building2}
          kicker="Jugador"
          title="Mi club"
          description="Los clubes a los que perteneces."
        />
        {clubs.length === 0 ? (
          <p className="text-sm text-foreground/55">
            Todavía no perteneces a ningún club. Cuando un club te vincule,
            aparecerá aquí.
          </p>
        ) : (
          <ul className="space-y-3">
            {clubs.map((c) => (
              <li key={c.id} className="tp-panel space-y-2 p-4 sm:p-6">
                <h2 className="text-lg font-black">{c.name}</h2>
                {c.address && (
                  <p className="flex items-center gap-2 text-sm text-foreground/75">
                    <MapPin className="size-4 shrink-0" />
                    {c.address}
                  </p>
                )}
                {c.phone && (
                  <p className="flex items-center gap-2 text-sm text-foreground/75">
                    <Phone className="size-4 shrink-0" />
                    {c.phone}
                  </p>
                )}
                {c.email && (
                  <p className="flex items-center gap-2 text-sm text-foreground/75">
                    <Mail className="size-4 shrink-0" />
                    {c.email}
                  </p>
                )}
                {c.website && (
                  <p className="flex items-center gap-2 text-sm text-foreground/75">
                    <Globe className="size-4 shrink-0" />
                    {c.website}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
