import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ExternalLink, Pencil, Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FamilyHeader } from "@/components/family/family-header";
import { DeleteMatchButton } from "@/components/matches/delete-match-button";
import { getMatch } from "@/lib/matches/server";
import { MATCH_TYPE_LABELS, rivalName } from "@/lib/matches/validation";
import { formatMatchDate } from "@/lib/matches/format";
import { roundLabel } from "@/lib/matches/rounds";

export const metadata = { title: "Partido" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-foreground/45">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-sm font-semibold text-foreground">
        {children}
      </dd>
    </div>
  );
}

export default async function PartidoPage({
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

  const rival = rivalName(match);

  return (
    <div className="tp-page">
      <div className="tp-page-pad mx-auto max-w-3xl space-y-6">
        <Link
          href="/mis-partidos"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-foreground/60 hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Mis partidos
        </Link>
        <FamilyHeader
          icon={Swords}
          kicker={MATCH_TYPE_LABELS[match.matchType]}
          title={
            match.finalResult?.split(" ").join(", ") ??
            MATCH_TYPE_LABELS[match.matchType]
          }
          description={formatMatchDate(match.matchDate, true)}
        />

        <dl className="tp-panel divide-y divide-[#050505]/8 px-4 dark:divide-white/10 sm:px-6">
          <Row label="Tipo">{MATCH_TYPE_LABELS[match.matchType]}</Row>
          <Row label="Fecha">{formatMatchDate(match.matchDate, true)}</Row>
          <Row label="Resultado final">
            <span className="font-mono tabular-nums">
              {match.finalResult ?? "Sin resultado"}
            </span>
          </Row>
          {match.tournamentName && <Row label="Torneo">{match.tournamentName}</Row>}
          {roundLabel(match.round, match.roundOther) && (
            <Row label="Ronda">{roundLabel(match.round, match.roundOther)}</Row>
          )}
          <Row label="Rival">{rival ?? "Sin rival indicado"}</Row>
          {match.rivalLicense && <Row label="Licencia del rival">{match.rivalLicense}</Row>}
          <Row label="Palmarés público">
            {match.showOnProfile ? "Publicado (sin el rival)" : "No publicado"}
          </Row>
          {match.tournamentUrl && (
            <Row label="Enlace">
              <a
                href={match.tournamentUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="inline-flex items-center gap-1 text-brand-ink hover:underline"
              >
                {match.tournamentUrl}
                <ExternalLink className="size-3.5 shrink-0" />
              </a>
            </Row>
          )}
        </dl>

        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <DeleteMatchButton matchId={match.id} />
          <Link
            href={`/mis-partidos/${match.id}/editar`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-black text-brand-foreground hover:bg-brand/90"
          >
            <Pencil className="size-4" />
            Editar
          </Link>
        </div>
      </div>
    </div>
  );
}
