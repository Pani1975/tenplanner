import Link from "next/link";
import { GuestImportCard } from "./guest-import";
import { GuestClaimCard } from "./guest-claim";
import { guestTournamentIds } from "@/lib/tournaments/guest-server";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, ChevronRight, Plus, Trophy, Users } from "lucide-react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { clubs } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getOrganizer, listTournaments } from "@/lib/tournaments/server";
import { formatDateRange, STATUS_BADGE } from "@/lib/tournaments/labels";
import type { TournamentStatus } from "@/lib/tournaments/status";
import { cn } from "@/lib/utils";

type Props = { searchParams: Promise<{ archivados?: string }> };

export default async function TorneosPage({ searchParams }: Props) {
  const showArchived = (await searchParams).archivados === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [t, locale, organizer] = await Promise.all([
    getTranslations("tournaments"),
    getLocale(),
    getOrganizer(user.id),
  ]);
  const [allRows, club] = await Promise.all([
    listTournaments(organizer),
    organizer.clubId
      ? db
          .select({ name: clubs.name })
          .from(clubs)
          .where(eq(clubs.id, organizer.clubId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);
  const archivedCount = allRows.filter((r) => r.archivedAt).length;
  // Torneos de prueba (sin cuenta) cuyo enlace tiene este navegador.
  const guestIds = await guestTournamentIds();
  const rows = allRows.filter((r) => !!r.archivedAt === showArchived);

  return (
    <div className="tp-page-pad mx-auto w-full max-w-5xl space-y-6">
      <header className="tp-card-blue flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/80">
            <Trophy className="size-4" />
            {organizer.clubId ? t("list.kickerClub") : t("list.kickerCoach")}
          </p>
          <h1 className="tp-title text-4xl leading-tight sm:text-5xl">
            {t("list.title")}
            {club && (
              <span className="block text-2xl text-white/75 sm:text-3xl">
                {club.name}
              </span>
            )}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/85">
            {t("list.intro")}
          </p>
        </div>
        <Link
          href="/torneos/nuevo"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#d6f04a] px-5 text-sm font-bold text-black transition hover:bg-[#c5df3c]"
        >
          <Plus className="size-4" />
          {t("list.new")}
        </Link>
      </header>

      {guestIds.length > 0 && <GuestClaimCard count={guestIds.length} />}
      <GuestImportCard />

      <nav
        className="grid grid-cols-2 gap-1 rounded-full bg-foreground/5 p-1"
        aria-label={t("archive.tabs")}
      >
        {[false, true].map((v) => (
          <Link
            key={String(v)}
            href={v ? "/torneos?archivados=1" : "/torneos"}
            aria-current={showArchived === v ? "page" : undefined}
            className={cn(
              "inline-flex min-h-11 items-center justify-center rounded-full text-sm font-bold",
              showArchived === v
                ? "bg-black text-white dark:bg-[#d6f04a] dark:text-black"
                : "text-foreground/70"
            )}
          >
            {v
              ? t("archive.tabArchived", { count: archivedCount })
              : t("archive.tabActive")}
          </Link>
        ))}
      </nav>

      {rows.length === 0 && showArchived ? (
        <p className="tp-card-soft p-6 text-center text-sm">
          {t("archive.empty")}
        </p>
      ) : rows.length === 0 ? (
        <div className="tp-card-soft p-8 text-center">
          <Trophy className="mx-auto mb-3 size-8 text-[var(--brand-ink)]" />
          <p className="tp-title text-xl">{t("list.emptyTitle")}</p>
          <p className="mt-1 text-sm text-foreground/70">
            {t("list.emptyText")}
          </p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => {
            const status = r.effectiveStatus as TournamentStatus;
            return (
              <li key={r.id}>
                <Link
                  href={`/torneos/${r.id}`}
                  className="tp-card group flex h-full flex-col gap-3 p-5 transition hover:border-[var(--brand-ink)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h2 className="tp-title text-xl leading-snug">{r.name}</h2>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                        STATUS_BADGE[status]
                      )}
                    >
                      {t(`status.${status}`)}
                    </span>
                  </div>
                  <p className="flex items-center gap-2 text-sm text-foreground/70">
                    <CalendarDays className="size-4" />
                    {formatDateRange(r.startDate, r.endDate, locale)}
                  </p>
                  {r.circuit && (
                    <p className="text-xs font-bold uppercase text-[var(--brand-ink)]">
                      {r.circuit.season
                        ? `${r.circuit.name} · ${r.circuit.season}`
                        : r.circuit.name}
                    </p>
                  )}
                  <p className="text-sm text-foreground/70">
                    {t(`modality.${r.modality}`)} · {t(`format.${r.format}`)}
                  </p>
                  <div className="mt-auto flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold">
                      <Users className="size-4 text-[var(--brand-ink)]" />
                      {r.maxEntries
                        ? t("list.spots", {
                            taken: r.spotsTaken,
                            max: r.maxEntries,
                          })
                        : t("list.entries", { count: r.spotsTaken })}
                      {r.waitlistCount > 0 &&
                        ` · ${t("list.waitlist", { count: r.waitlistCount })}`}
                    </span>
                    <ChevronRight className="size-4 text-foreground/40 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
