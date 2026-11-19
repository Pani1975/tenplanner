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

  // Fechas a texto para el cliente.
  const t = detail.tournament;
  return (
    <TournamentManager
      tournament={{
        id: t.id,
        name: t.name,
        slug: t.slug,
        status: t.status,
        effectiveStatus: t.effectiveStatus,
        modality: t.modality as "singles" | "doubles",
        format: t.format as "knockout" | "round_robin",
        levelCode: t.levelCode,
        startDate: t.startDate,
        endDate: t.endDate,
        registrationDeadline: t.registrationDeadline?.toISOString() ?? null,
        maxEntries: t.maxEntries,
        isClub: t.clubId !== null,
        visibility: t.visibility as "public" | "private",
        circuit: t.circuit,
        description: t.description,
        rules: {
          bestOf: t.bestOf as 1 | 3 | 5,
          gamesPerSet: t.gamesPerSet,
          finalSet: t.finalSet as "full" | "super_tiebreak",
        },
      }}
      entries={detail.entries.map((e) => ({
        id: e.id,
        source: e.source,
        status: e.status,
        studentId: e.studentId,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        isMinor: e.isMinor,
        guardianName: e.guardianName,
        guardianEmail: e.guardianEmail,
        guardianPhone: e.guardianPhone,
        levelCode: e.levelCode,
        partnerFirstName: e.partnerFirstName,
        partnerLastName: e.partnerLastName,
        partnerIsMinor: e.partnerIsMinor,
        partnerEmail: e.partnerEmail,
        partnerPhone: e.partnerPhone,
        partnerGuardianName: e.partnerGuardianName,
        partnerGuardianEmail: e.partnerGuardianEmail,
        partnerGuardianPhone: e.partnerGuardianPhone,
        consentAt: e.consentAt?.toISOString() ?? null,
        consentMethod: e.consentMethod,
        createdAt: e.createdAt.toISOString(),
        contactsHidden: e.contactsHidden,
        seed: e.seed,
        image: e.image,
      }))}
      matches={detail.matches.map((m) => ({
        id: m.id,
        round: m.round,
        position: m.position,
        entryAId: m.entryAId,
        entryBId: m.entryBId,
        status: m.status,
        winnerEntryId: m.winnerEntryId,
        score: m.score,
        resultType: m.resultType,
        courtLabel: m.courtLabel,
      }))}
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
