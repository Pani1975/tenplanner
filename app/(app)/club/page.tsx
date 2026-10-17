import { createClient } from "@/lib/supabase/server";
import { getOwnedClub, getCoachMemberships, listClubRoster } from "@/lib/clubs";
import { getActiveSport } from "@/lib/sports";
import { SPORT_LABELS } from "@/lib/sport-constants";
import { redirect } from "next/navigation";
import { ClubOwnerPanel } from "./club-owner-panel";
import { NewClubForm } from "./new-club-form";
import { Users2 } from "lucide-react";

export default async function ClubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [ownedClub, coachOf, activeSport] = await Promise.all([
    getOwnedClub(user.id),
    getCoachMemberships(user.id),
    getActiveSport(user.id),
  ]);

  if (ownedClub) {
    const { members, invites } = await listClubRoster(ownedClub.id);
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <div>
          <p className="tp-kicker">Mi club</p>
          <h1 className="mt-2 text-3xl font-black text-foreground">
            {ownedClub.name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-foreground/62">
            Invita monitores por email. Cuando acepten, tendrás acceso
            compartido a sus sesiones, alumnos, grupos y calendario de ese
            deporte — cada uno conserva su propio panel.
          </p>
        </div>
        <ClubOwnerPanel
          club={ownedClub}
          initialMembers={members}
          initialInvites={invites}
          defaultSport={activeSport}
        />
        {coachOf.length > 0 && (
          <div className="rounded-[28px] border border-[#050505]/10 bg-white p-5 dark:border-white/10 dark:bg-[#10100e]">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-foreground/70">
              <Users2 className="size-4" />
              También eres monitor en
            </h2>
            <ul className="mt-3 space-y-2">
              {coachOf.map(({ club, sports }) => (
                <li
                  key={club.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#050505]/10 px-4 py-3 text-sm font-semibold text-foreground dark:border-white/10"
                >
                  <span className="truncate">{club.name}</span>
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-foreground/60">
                    {sports.map((sport) => SPORT_LABELS[sport]).join(" · ")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <p className="tp-kicker">Mi club</p>
        <h1 className="mt-2 text-3xl font-black text-foreground">
          Monitores y clubs
        </h1>
      </div>

      {coachOf.length > 0 && (
        <div className="rounded-[28px] border border-[#050505]/10 bg-white p-5 dark:border-white/10 dark:bg-[#10100e]">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-foreground/70">
            <Users2 className="size-4" />
            Formas parte de
          </h2>
          <ul className="mt-3 space-y-2">
            {coachOf.map(({ club, sports }) => (
              <li
                key={club.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#050505]/10 px-4 py-3 text-sm font-semibold text-foreground dark:border-white/10"
              >
                <span className="truncate">{club.name}</span>
                <span className="flex shrink-0 flex-wrap justify-end gap-1">
                  {sports.map((sport) => (
                    <span
                      key={sport}
                      className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-foreground/70"
                    >
                      {SPORT_LABELS[sport]}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-foreground/50">
            Ese club tiene acceso compartido a tus sesiones, alumnos, grupos y
            calendario.
          </p>
        </div>
      )}

      <div className="rounded-[28px] border border-[#050505]/10 bg-white p-5 dark:border-white/10 dark:bg-[#10100e]">
        <h2 className="text-sm font-black uppercase tracking-wide text-foreground/70">
          ¿Diriges un club?
        </h2>
        <p className="mt-2 text-sm leading-6 text-foreground/62">
          Regístralo para invitar a tus monitores y gestionar su espacio desde
          una cuenta común. Es solo informativo por ahora, sin facturación.
        </p>
        <div className="mt-4">
          <NewClubForm />
        </div>
      </div>
    </div>
  );
}
