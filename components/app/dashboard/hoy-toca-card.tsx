import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { getActiveWorkClubId } from "@/lib/clubs";
import { getActiveSport } from "@/lib/sports";
import { HOY_TOCA } from "@/lib/session-engine/messages";
import {
  buildProposal,
  findNextTraining,
  localDateKey,
} from "@/lib/session-engine/today";
import { HoyTocaClient } from "./hoy-toca-client";

const CARD =
  "rounded-lg border border-[#050505]/10 bg-white p-5 dark:border-white/10 dark:bg-white/[0.04] sm:p-6";

/**
 * Primera tarjeta del panel: la clase del próximo entreno ya montada por el
 * motor (F1). Se genera al cargar; no se guarda nada hasta "Guardar".
 */
export async function HoyTocaCard({
  userId,
  sessionCreationEnabled,
}: {
  userId: string;
  sessionCreationEnabled: boolean;
}) {
  if (!sessionCreationEnabled) return null;
  const [activeClubId, sport] = await Promise.all([
    getActiveWorkClubId(userId),
    getActiveSport(userId),
  ]);
  const next = await findNextTraining(userId, activeClubId, sport);

  if (!next) {
    return (
      <section className={CARD} aria-labelledby="hoy-toca-title">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {HOY_TOCA.kicker}
        </p>
        <h2
          id="hoy-toca-title"
          className="mt-1 text-lg font-black text-foreground"
        >
          {HOY_TOCA.title}
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {HOY_TOCA.noGroups}
        </p>
        <Link
          href="/groups"
          className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[#D6FF38] px-4 text-sm font-bold text-[#050505]"
        >
          {HOY_TOCA.goGroups}
        </Link>
      </section>
    );
  }

  if (next.existingSessionId) {
    return (
      <section className={CARD} aria-labelledby="hoy-toca-title">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          {HOY_TOCA.kicker}
        </p>
        <h2
          id="hoy-toca-title"
          className="mt-1 flex items-center gap-2 text-lg font-black text-foreground"
        >
          <CalendarClock className="size-5 text-brand" />
          {HOY_TOCA.alreadyHave(next.groupName)}
        </h2>
        <Link
          href={`/sessions/${next.existingSessionId}`}
          className="mt-3 inline-flex min-h-11 items-center rounded-full bg-[#D6FF38] px-4 text-sm font-bold text-[#050505]"
        >
          {HOY_TOCA.openSession}
        </Link>
      </section>
    );
  }

  const date = localDateKey(next.at);
  const proposal = await buildProposal(userId, activeClubId, {
    groupId: next.groupId,
    date,
    durationMinutes: 60,
    intensity: "media",
    focus: "auto",
    attendeeIds: null,
  });
  if (!proposal) return null;

  return (
    <HoyTocaClient
      initial={proposal}
      date={date}
      scheduledAt={next.at.toISOString()}
    />
  );
}
