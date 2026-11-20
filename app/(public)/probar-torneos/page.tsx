import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  CalendarDays,
  ChevronRight,
  Mail,
  Plus,
  Trophy,
  Users,
} from "lucide-react";
import { guestOrganizer } from "@/lib/tournaments/guest-server";
import { listTournaments } from "@/lib/tournaments/server";
import { formatDateRange, STATUS_BADGE } from "@/lib/tournaments/labels";
import type { TournamentStatus } from "@/lib/tournaments/status";
import { cn } from "@/lib/utils";
import {
  GuestBanner,
  LegacyGuestTournaments,
  LostLinkForm,
} from "./guest-client";

export async function generateMetadata() {
  const t = await getTranslations("tournaments.guest");
  return { title: t("metaTitle"), description: t("metaDescription") };
}

export default async function ProbarTorneosPage({
  searchParams,
}: {
  searchParams: Promise<{ enlace?: string }>;
}) {
  const [t, tg, locale, { enlace }] = await Promise.all([
    getTranslations("tournaments"),
    getTranslations("tournaments.guest"),
    getLocale(),
    searchParams,
  ]);
  // Torneos de prueba cuyo enlace de edición tiene este navegador.
  const o = await guestOrganizer();
  const rows = o.guest?.tournamentIds.length ? await listTournaments(o) : [];

  return (
    <div className="tp-page-pad mx-auto w-full max-w-5xl space-y-6">
      <header className="tp-card-blue flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/80">
            <Trophy className="size-4" />
            {tg("kicker")}
          </p>
          <h1 className="tp-title text-4xl leading-tight sm:text-5xl">
            {t("list.title")}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/85">{tg("intro")}</p>
        </div>
        <Link
          href="/probar-torneos/nuevo"
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#d6f04a] px-5 text-sm font-bold text-black transition hover:bg-[#c5df3c]"
        >
          <Plus className="size-4" />
          {t("list.new")}
        </Link>
      </header>

      <GuestBanner />
      <LegacyGuestTournaments />

      {rows.length === 0 ? (
        <div className="tp-card-soft p-8 text-center">
          <Trophy className="mx-auto mb-3 size-8 text-[var(--brand-ink)]" />
          <p className="tp-title text-xl">{tg("emptyTitle")}</p>
          <p className="mt-1 text-sm text-foreground/70">{tg("emptyText")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => {
            const status = r.effectiveStatus as TournamentStatus;
            return (
              <li key={r.id}>
                <Link
                  href={`/probar-torneos/${r.id}`}
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
                  {!r.guestVerifiedAt && (
                    <p className="flex items-center gap-2 text-xs font-semibold text-amber-700 dark:text-amber-400">
                      <Mail className="size-3.5" />
                      {tg("pendingShort")}
                    </p>
                  )}
                  <div className="mt-auto flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold">
                      <Users className="size-4 text-[var(--brand-ink)]" />
                      {r.maxEntries
                        ? t("list.spots", {
                            taken: r.spotsTaken,
                            max: r.maxEntries,
                          })
                        : t("list.entries", { count: r.spotsTaken })}
                    </span>
                    <ChevronRight className="size-4 text-foreground/40 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <LostLinkForm expired={enlace === "caducado"} />
    </div>
  );
}
