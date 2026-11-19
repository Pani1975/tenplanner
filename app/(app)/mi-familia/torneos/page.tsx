import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ChevronRight, Lock, Trophy } from "lucide-react";
import { dmSans } from "@/app/fonts/dm-sans";
import { FamilyHeader, NoPlayers } from "@/components/family/family-header";
import { createClient } from "@/lib/supabase/server";
import { listFamilyTournaments } from "@/lib/tournaments/family";
import {
  ENTRY_BADGE,
  formatDateRange,
  STATUS_BADGE,
} from "@/lib/tournaments/labels";
import type { TimelineTab } from "@/lib/tournaments/timeline";
import { cn } from "@/lib/utils";

const TABS: TimelineTab[] = ["current", "upcoming", "past"];

type Props = { searchParams: Promise<{ tab?: string }> };

// Torneos de los alumnos de la familia (o del propio jugador adulto):
// del club o del monitor, públicos y privados, en pestañas.
export default async function FamilyTournamentsPage({ searchParams }: Props) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ tab }, t, locale, data] = await Promise.all([
    searchParams,
    getTranslations("tournaments"),
    getLocale(),
    listFamilyTournaments(user.id),
  ]);
  const byTab = Object.fromEntries(
    TABS.map((k) => [k, data.tournaments.filter((x) => x.tab === k)])
  ) as Record<TimelineTab, typeof data.tournaments>;
  // Por defecto, la primera pestaña con algo.
  const current: TimelineTab = TABS.includes(tab as TimelineTab)
    ? (tab as TimelineTab)
    : (TABS.find((k) => byTab[k].length) ?? "upcoming");
  const list = current === "past" ? [...byTab.past].reverse() : byTab[current];

  return (
    <div className="tp-page">
      <div className={`${dmSans.variable} tp-torneos tp-page-pad space-y-6`}>
        <FamilyHeader
          icon={Trophy}
          kicker={t("family.kicker")}
          title={t("list.title")}
          description={t("family.intro")}
        />
        {!data.hasPlayers ? (
          <NoPlayers />
        ) : (
          <>
            <nav
              className="grid grid-cols-3 gap-1 rounded-full bg-foreground/5 p-1"
              aria-label={t("family.tabs")}
            >
              {TABS.map((k) => (
                <Link
                  key={k}
                  href={`/mi-familia/torneos?tab=${k}`}
                  aria-current={k === current ? "page" : undefined}
                  className={cn(
                    "flex min-h-11 items-center justify-center rounded-full px-2 text-sm font-bold",
                    k === current
                      ? "bg-[#1a6db5] text-white"
                      : "text-foreground/70"
                  )}
                >
                  {t(`family.tab.${k}`)} ({byTab[k].length})
                </Link>
              ))}
            </nav>

            {list.length === 0 ? (
              <div className="tp-card-soft p-6 text-sm">
                {t(`family.empty.${current}`)}
              </div>
            ) : (
              <ul className="grid gap-3 sm:grid-cols-2">
                {list.map((x) => (
                  <li key={x.slug}>
                    <Link
                      href={`/mi-familia/torneos/${x.slug}`}
                      className="tp-card group flex h-full flex-col gap-2 p-5 transition hover:border-[#1a6db5]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <h2 className="tp-title text-xl leading-snug">
                          {x.name}
                        </h2>
                        <span
                          className={cn(
                            "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                            STATUS_BADGE[x.status]
                          )}
                        >
                          {t(`status.${x.status}`)}
                        </span>
                      </div>
                      {x.circuit && (
                        <p className="text-xs font-bold uppercase text-[var(--brand-ink)]">
                          {x.circuit}
                        </p>
                      )}
                      <p className="text-sm text-foreground/70">
                        {formatDateRange(x.startDate, x.endDate, locale)} ·{" "}
                        {t(`modality.${x.modality}`)} ·{" "}
                        {t(`format.${x.format}`)}
                      </p>
                      <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-1 text-xs">
                        {x.visibility === "private" && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 font-semibold">
                            <Lock className="size-3" />
                            {t("visibility.private")}
                          </span>
                        )}
                        {x.mine.map((m, i) => (
                          <span
                            key={i}
                            className={cn(
                              "rounded-full px-2 py-0.5 font-bold",
                              ENTRY_BADGE[m.status]
                            )}
                          >
                            {m.player}: {t(`entryStatus.${m.status}`)}
                          </span>
                        ))}
                        <ChevronRight className="ml-auto size-4 text-foreground/40" />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}
