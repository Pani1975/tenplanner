import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import { TournamentView } from "@/app/t/[slug]/tournament-view";
import { createClient } from "@/lib/supabase/server";
import {
  getTournamentForFamily,
  listFamilyTournaments,
} from "@/lib/tournaments/family";
import { ConsentCard } from "../consent-card";
import { getPublicTournament } from "@/lib/tournaments/public";
import { publishedNews, publishedPhotos } from "@/lib/tournaments/media";

type Props = { params: Promise<{ slug: string }> };

const SLUG = /^[a-z0-9-]{3,80}$/;

// Ficha del torneo para familias y jugadores vinculados: también los
// privados. Solo lectura y sin datos de contacto.
export default async function FamilyTournamentPage({ params }: Props) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const allowed = await getTournamentForFamily(user.id, slug);
  if (!allowed) notFound();
  const [t, tr, mine] = await Promise.all([
    getPublicTournament(slug, { allowPrivate: true }),
    getTranslations("tournaments"),
    listFamilyTournaments(user.id).then(
      (r) => r.tournaments.find((x) => x.slug === slug)?.mine ?? []
    ),
  ]);
  if (!t) notFound();

  return (
    <TournamentView
      t={t}
      withRegistration={false}
      media={{
        news: await publishedNews(t.id),
        photos: await publishedPhotos(t.id),
      }}
      notice={mine
        .filter((m) => m.needsConsent)
        .map((m) => (
          <ConsentCard
            key={`${m.entryId}-${m.side}`}
            entryId={m.entryId}
            side={m.side}
            player={m.player}
            tournamentName={t.name}
            organizer={t.organizer}
          />
        ))}
      top={
        <Link
          href="/mi-familia/torneos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/75 hover:text-white"
        >
          <ArrowLeft className="size-4" />
          {tr("list.title")}
        </Link>
      }
    />
  );
}
