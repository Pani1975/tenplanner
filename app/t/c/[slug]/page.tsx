import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Trophy } from "lucide-react";
import { dmSans } from "@/app/fonts/dm-sans";
import { formatDay, STATUS_BADGE } from "@/lib/tournaments/labels";
import { getPublicCircuit } from "@/lib/tournaments/public";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const SLUG = /^[a-z0-9-]{3,80}$/;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const c = SLUG.test(slug) ? await getPublicCircuit(slug) : null;
  return {
    title: c ? c.name : "Circuito",
    robots: { index: false, follow: false },
  };
}

// Clasificación general pública de un circuito: puntos por torneo
// finalizado (solo nombre e iniciales de los apellidos).
export default async function PublicCircuitPage({ params }: Props) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const [c, t, locale] = await Promise.all([
    getPublicCircuit(slug),
    getTranslations("tournaments"),
    getLocale(),
  ]);
  if (!c) notFound();
  const k = c.points.knockout;

  return (
    <div
      className={`${dmSans.variable} tp-torneos min-h-[100dvh] bg-background text-foreground`}
    >
      <header className="bg-[#1a6db5] px-5 pb-10 pt-6 text-white">
        <div className="mx-auto max-w-3xl space-y-2">
          <p className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/85">
            <Trophy className="size-4" />
            {t("circuit.kicker")}
          </p>
          <h1 className="tp-title text-4xl leading-tight sm:text-5xl">
            {c.name}
          </h1>
          <p className="text-sm text-white/85">
            {[
              c.season,
              c.organizer && t("public.organizer", { name: c.organizer }),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 pb-16 pt-6">
        <section className="space-y-3">
          <h2 className="tp-title text-2xl">{t("circuit.standings")}</h2>
          {c.standings.length === 0 ? (
            <p className="tp-card p-5 text-sm text-foreground/70">
              {t("circuit.noResults")}
            </p>
          ) : (
            <div className="tp-card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase text-foreground/55">
                    <th className="px-4 py-2">#</th>
                    <th className="py-2">{t("public.player")}</th>
                    {c.finishedNames.map((n, i) => (
                      <th
                        key={i}
                        className="hidden px-2 py-2 text-center sm:table-cell"
                        title={n}
                      >
                        {i + 1}
                      </th>
                    ))}
                    <th className="px-4 py-2 text-right">
                      {t("circuit.points")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {c.standings.map((r, i) => (
                    <tr key={i} className="border-t border-foreground/10">
                      <td className="px-4 py-2 font-bold">{r.position}</td>
                      <td className="py-2 font-semibold">
                        {r.name}
                        <span className="block text-xs font-normal text-foreground/55">
                          {t("circuit.played", { count: r.tournaments })}
                        </span>
                      </td>
                      {r.byTournament.map((p, j) => (
                        <td
                          key={j}
                          className="hidden px-2 py-2 text-center text-foreground/70 sm:table-cell"
                        >
                          {p ?? "–"}
                        </td>
                      ))}
                      <td className="tp-title px-4 py-2 text-right text-lg text-[var(--brand-ink)]">
                        {r.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="tp-title text-2xl">{t("circuit.tournaments")}</h2>
          <ol className="space-y-2">
            {c.tournaments.map((tt, i) => (
              <li key={tt.slug}>
                <Link
                  href={`/t/${tt.slug}`}
                  className="tp-card flex items-center justify-between gap-3 p-4 hover:border-[#1a6db5]"
                >
                  <span>
                    <span className="mr-2 font-bold text-foreground/45">
                      {i + 1}
                    </span>
                    <span className="font-semibold">{tt.name}</span>
                    <span className="block text-xs text-foreground/60">
                      {formatDay(tt.startDate, locale)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                      STATUS_BADGE[tt.status]
                    )}
                  >
                    {t(`status.${tt.status}`)}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>

        <section className="tp-card-soft space-y-1 p-4 text-sm">
          <h2 className="font-bold">{t("circuit.howPoints")}</h2>
          <p>
            {t("circuit.knockoutPoints", {
              winner: k.winner,
              final: k.final,
              semifinal: k.semifinal,
              quarterfinal: k.quarterfinal,
              earlier: k.round_of_16,
            })}
          </p>
          <p>
            {t("circuit.roundRobinPoints", {
              list: c.points.roundRobin.join(", "),
            })}
          </p>
          <p>{t("circuit.participation", { n: c.points.participation })}</p>
        </section>
      </main>
    </div>
  );
}
