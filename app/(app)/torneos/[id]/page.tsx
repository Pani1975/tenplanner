import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadSkillLevels } from "@/lib/skill-levels-repo";
import { levelOptions } from "@/lib/tournaments/levels";
import {
  getOrganizer,
  getTournamentDetail,
  TournamentError,
} from "@/lib/tournaments/server";
import { TournamentManager } from "./tournament-manager";
import { managerData } from "./manager-data";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Props = { params: Promise<{ id: string }> };

export default async function TorneoPage({ params }: Props) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const organizer = await getOrganizer(user.id);
  const detail = await getTournamentDetail(organizer, id).catch((e) => {
    if (e instanceof TournamentError && e.code === "not_found") return null;
    throw e;
  });
  if (!detail) notFound();
  const levels = levelOptions(
    await loadSkillLevels().catch(() => []),
    detail.tournament.sport
  );

  const data = await managerData(detail);
  return (
    <TournamentManager
      tournament={data.tournament}
      entries={data.entries}
      matches={data.matches}
      levels={levels}
      canSeeContacts={organizer.canSeeContacts}
      baseUrl={await siteBaseUrl()}
    />
  );
}

/** Dirección del sitio para el enlace público (la del entorno o la petición). */
async function siteBaseUrl() {
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "");
  }
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
