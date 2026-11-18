import { createClient } from "@/lib/supabase/server";
import {
  canUserCreateClub,
  getOwnedClub,
  getCoachMemberships,
} from "@/lib/clubs";
import { SPORT_LABELS } from "@/lib/sport-constants";
import { redirect } from "next/navigation";
import { ClubIdentityForm } from "@/components/app/club-identity-form";
import { clubIdentityFromRow, getClubStats } from "@/lib/club-profile";
import { NewClubForm } from "./new-club-form";
import { BookOpen, Users2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { getTerm } from "@/lib/i18n-terms";

function ObjectivesLink({ clubId }: { clubId: string }) {
  const tx = useTranslations("ui.s_club_page");
  return (
    <Link
      href={`/club/${clubId}/objetivos`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#050505]/15 px-3 py-1.5 text-[11px] font-black uppercase text-foreground/70 transition-colors hover:border-brand hover:text-brand dark:border-white/15"
    >
      <BookOpen className="size-3.5" />
      {tx("objetivos")}
    </Link>
  );
}

export default async function ClubPage() {
  const term = await getTerm();
  const tx = await getTranslations("ui.s_club_page");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [ownedClub, coachOf] = await Promise.all([
    getOwnedClub(user.id),
    getCoachMemberships(user.id),
  ]);

  // Un club se crea con su propia cuenta ("Como Club" al registrarse); un
  // monitor no crea clubes desde la suya. Los administradores sí.
  const canCreateClub = await canUserCreateClub(user.id, user.user_metadata);

  if (ownedClub) {
    const stats = await getClubStats(ownedClub.id);
    return (
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <div>
          <p className="tp-kicker">{tx("miClub")}</p>
          <h1 className="mt-2 text-3xl font-black text-foreground">
            {ownedClub.name}
          </h1>
          <p className="mt-2 text-sm leading-6 text-foreground/62">
            {tx("datosFotosEInstalaciones")}
          </p>
        </div>
        <ClubIdentityForm
          key={ownedClub.updatedAt.toISOString()}
          clubId={ownedClub.id}
          userId={user.id}
          canEdit
          stats={stats}
          initial={clubIdentityFromRow(ownedClub, user.email)}
        />
        {coachOf.length > 0 && (
          <div className="rounded-[28px] border border-[#050505]/10 bg-white p-5 dark:border-white/10 dark:bg-[#10100e]">
            <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-foreground/70">
              <Users2 className="size-4" />
              {tx("tambienEresMonitorEn")}
            </h2>
            <ul className="mt-3 space-y-2">
              {coachOf.map(({ club, sports }) => (
                <li
                  key={club.id}
                  className="flex items-center justify-between gap-3 rounded-2xl border border-[#050505]/10 px-4 py-3 text-sm font-semibold text-foreground dark:border-white/10"
                >
                  <span className="truncate">{club.name}</span>
                  <span className="flex shrink-0 items-center gap-3">
                    <span className="text-[10px] font-black uppercase tracking-wide text-foreground/60">
                      {sports.map((sport) => SPORT_LABELS[sport]).join(" · ")}
                    </span>
                    <ObjectivesLink clubId={club.id} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  const clubProfiles = await Promise.all(
    coachOf.map(async ({ club }) => ({
      club,
      stats: await getClubStats(club.id),
    }))
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
      <div>
        <p className="tp-kicker">{tx("miClub")}</p>
        <h1 className="mt-2 text-3xl font-black text-foreground">
          {tx("monitoresYClubs")}
        </h1>
      </div>

      {coachOf.length > 0 && (
        <div className="rounded-[28px] border border-[#050505]/10 bg-white p-5 dark:border-white/10 dark:bg-[#10100e]">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wide text-foreground/70">
            <Users2 className="size-4" />
            {tx("formasParteDe")}
          </h2>
          <ul className="mt-3 space-y-2">
            {coachOf.map(({ club, sports }) => (
              <li
                key={club.id}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#050505]/10 px-4 py-3 text-sm font-semibold text-foreground dark:border-white/10"
              >
                <span className="truncate">{club.name}</span>
                <span className="flex shrink-0 flex-wrap items-center justify-end gap-1">
                  <ObjectivesLink clubId={club.id} />
                  {sports.map((sport) => (
                    <span
                      key={sport}
                      className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-foreground/70"
                    >
                      {term(SPORT_LABELS[sport])}
                    </span>
                  ))}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs leading-5 text-foreground/50">
            {tx("loQueHacesEn")}
          </p>
        </div>
      )}

      {/* Ficha de cada club del que es monitor (solo lectura). */}
      {clubProfiles.map(({ club, stats }) => (
        <ClubIdentityForm
          key={club.id}
          clubId={club.id}
          userId={user.id}
          canEdit={false}
          stats={stats}
          initial={clubIdentityFromRow(club)}
        />
      ))}

      <div className="rounded-[28px] border border-[#050505]/10 bg-white p-5 dark:border-white/10 dark:bg-[#10100e]">
        <h2 className="text-sm font-black uppercase tracking-wide text-foreground/70">
          {tx("dirigesUnClub")}
        </h2>
        <p className="mt-2 text-sm leading-6 text-foreground/62">
          {canCreateClub
            ? tx("registraloParaInvitarA")
            : tx("unClubSeDa")}
        </p>
        {canCreateClub && (
          <div className="mt-4">
            <NewClubForm />
          </div>
        )}
      </div>
    </div>
  );
}
