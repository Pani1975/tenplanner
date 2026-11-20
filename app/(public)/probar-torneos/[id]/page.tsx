import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { loadSkillLevels } from "@/lib/skill-levels-repo";
import { getSiteUrl } from "@/lib/email";
import { guestOrganizer } from "@/lib/tournaments/guest-server";
import { levelOptions } from "@/lib/tournaments/levels";
import { getTournamentDetail, TournamentError } from "@/lib/tournaments/server";
import { TournamentManager } from "@/app/(app)/torneos/[id]/tournament-manager";
import { managerData } from "@/app/(app)/torneos/[id]/manager-data";
import { GuestBanner, GuestEmailStatus } from "../guest-client";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ confirmado?: string }>;
};

// Ficha de un torneo de prueba: solo con su enlace de edición en este
// navegador (lo deja el propio alta o el enlace del correo).
export default async function TorneoPruebaPage({
  params,
  searchParams,
}: Props) {
  const [{ id }, { confirmado }] = await Promise.all([params, searchParams]);
  const tg = await getTranslations("tournaments.guest");
  const o = await guestOrganizer();
  const detail = o.guest?.tournamentIds.includes(id)
    ? await getTournamentDetail(o, id).catch((e) => {
        if (e instanceof TournamentError && e.code === "not_found") return null;
        throw e;
      })
    : null;
  if (!detail) {
    return (
      <div className="tp-page-pad mx-auto w-full max-w-5xl space-y-4">
        <p className="tp-card-soft p-6 text-sm">{tg("notFound")}</p>
        <Link href="/probar-torneos" className="font-bold underline">
          {tg("backToList")}
        </Link>
      </div>
    );
  }
  const t = detail.tournament;
  const levels = levelOptions(await loadSkillLevels().catch(() => []), t.sport);
  const data = await managerData(detail);
  return (
    <>
      <div className="tp-page-pad mx-auto w-full max-w-5xl space-y-3 pb-0">
        <GuestBanner />
        <GuestEmailStatus
          verified={!!t.guestVerifiedAt}
          email={t.guestEmail ?? ""}
          justConfirmed={confirmado === "1"}
        />
      </div>
      <TournamentManager
        tournament={{ ...data.tournament, guestVerified: !!t.guestVerifiedAt }}
        entries={data.entries}
        matches={data.matches}
        levels={levels}
        canSeeContacts
        baseUrl={getSiteUrl(
          process.env.NEXT_PUBLIC_SITE_URL ?? "https://tenplanner.com"
        )}
      />
    </>
  );
}
