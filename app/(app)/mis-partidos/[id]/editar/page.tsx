import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FamilyHeader } from "@/components/family/family-header";
import { MatchForm } from "@/components/matches/match-form";
import { getMatch } from "@/lib/matches/server";

export const metadata = { title: "Editar partido" };

export default async function EditarPartidoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const match = await getMatch(user.id, id);
  if (!match) notFound();

  return (
    <div className="tp-page">
      <div className="tp-page-pad mx-auto max-w-3xl space-y-6">
        <Link
          href={`/mis-partidos/${match.id}`}
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Volver al partido
        </Link>
        <FamilyHeader
          icon={Swords}
          kicker="Mis partidos"
          title="Editar partido"
          description="Los campos con * son obligatorios."
        />
        <MatchForm
          matchId={match.id}
          initial={{
            matchType: match.matchType,
            matchDate: match.matchDate,
            finalResult: match.finalResult ?? "",
            tournamentUrl: match.tournamentUrl ?? "",
            tournamentName: match.tournamentName ?? "",
            showOnProfile: match.showOnProfile,
            rivalFirstName: match.rivalFirstName ?? "",
            rivalLastName: match.rivalLastName ?? "",
            rivalLicense: match.rivalLicense ?? "",
          }}
        />
      </div>
    </div>
  );
}
