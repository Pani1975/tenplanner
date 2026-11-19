import { getLocale, getTranslations } from "next-intl/server";
import { CalendarClock } from "lucide-react";
import { roundLabelKey } from "@/lib/tournaments/bracket";
import type { PublicMatch } from "@/lib/tournaments/public";
import { scheduleByDay } from "@/lib/tournaments/schedule";
import { formatScore } from "@/lib/tournaments/score";
import { cn } from "@/lib/utils";

/** Orden de juego publicado: partidos por día, hora y pista, con resultado. */
export async function PublicSchedule({
  matches,
  format,
}: {
  matches: PublicMatch[];
  format: "knockout" | "round_robin";
}) {
  const [t, locale] = await Promise.all([
    getTranslations("tournaments"),
    getLocale(),
  ]);
  const days = scheduleByDay(matches);
  if (!days.length) return null;
  const total = Math.max(0, ...matches.map((m) => m.round));
  const knockout = format === "knockout";
  const roundTitle = (r: number) => {
    const k = roundLabelKey(r, total);
    return k.key === "round_of"
      ? t("public.roundOf", { size: k.size ?? 0 })
      : t(`public.${k.key}`);
  };
  const dayLabel = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, dd)));
  };

  return (
    <section className="space-y-3">
      <h2 className="tp-title flex items-center gap-2 text-2xl">
        <CalendarClock className="size-5 text-[var(--brand-ink)]" />
        {t("schedule.title")}
      </h2>
      {days.map((day) => (
        <div key={day.date} className="space-y-2">
          <h3 className="text-xs font-bold uppercase text-foreground/60">
            {dayLabel(day.date)}
          </h3>
          <ul className="tp-card divide-y divide-foreground/10">
            {day.items.map((m) => (
              <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="w-14 shrink-0">
                  <p className="font-bold tabular-nums">{m.time}</p>
                  {m.courtLabel && (
                    <p className="truncate text-xs text-foreground/60">
                      {m.courtLabel}
                    </p>
                  )}
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  <p className="leading-snug">
                    <span className={cn(m.winner === "a" && "font-bold")}>
                      {m.a ?? t("public.tbd")}
                    </span>{" "}
                    <span className="text-foreground/50">
                      {t("schedule.vs")}
                    </span>{" "}
                    <span className={cn(m.winner === "b" && "font-bold")}>
                      {m.b ?? t("public.tbd")}
                    </span>
                  </p>
                  <p className="text-xs text-foreground/60">
                    {knockout
                      ? roundTitle(m.round)
                      : t("public.matchday", { n: m.round })}
                    {m.status === "played" &&
                      ` · ${
                        m.resultType === "walkover"
                          ? t("public.walkover")
                          : m.score
                            ? formatScore(m.score)
                            : ""
                      }`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
