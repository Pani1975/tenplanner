import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { CalendarDays, MapPin, Trophy, Users } from "lucide-react";
import { dmSans } from "@/app/fonts/dm-sans";
import { loadSkillLevels } from "@/lib/skill-levels-repo";
import { formatDateRange, STATUS_BADGE } from "@/lib/tournaments/labels";
import { levelOptions } from "@/lib/tournaments/levels";
import { getPublicTournament } from "@/lib/tournaments/public";
import { cn } from "@/lib/utils";
import { PublicDraw } from "./public-draw";
import { RegistrationForm } from "./registration-form";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

const SLUG = /^[a-z0-9-]{3,80}$/;

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const t = SLUG.test(slug) ? await getPublicTournament(slug) : null;
  return {
    title: t ? t.name : "Torneo",
    // Hay menores entre los inscritos: la página no se indexa.
    robots: { index: false, follow: false },
  };
}

// Página pública del torneo: información, inscritos (solo nombre e
// iniciales), inscripción por enlace y, cuando empieza, cuadro y resultados.
export default async function PublicTournamentPage({ params }: Props) {
  const { slug } = await params;
  if (!SLUG.test(slug)) notFound();
  const [t, tr, locale] = await Promise.all([
    getPublicTournament(slug),
    getTranslations("tournaments"),
    getLocale(),
  ]);
  if (!t) notFound();
  const level = t.levelCode
    ? levelOptions(await loadSkillLevels().catch(() => []), t.sport).find(
        (l) => l.code === t.levelCode
      )
    : null;
  const open = t.acceptsRegistrations;

  return (
    <div
      className={`${dmSans.variable} tp-torneos min-h-[100dvh] bg-background text-foreground`}
    >
      <header className="bg-[#1a6db5] px-5 pb-10 pt-6 text-white">
        <div className="mx-auto max-w-3xl space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-bold",
                t.status === "open"
                  ? "bg-white text-[#1a6db5]"
                  : STATUS_BADGE[t.status]
              )}
            >
              {tr(`status.${t.status}`)}
            </span>
            {t.circuit && (
              <Link
                href={`/t/c/${t.circuit.slug}`}
                className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold hover:bg-white/25"
              >
                <Trophy className="size-3.5" />
                {t.circuit.season
                  ? `${t.circuit.name} · ${t.circuit.season}`
                  : t.circuit.name}
              </Link>
            )}
          </div>
          <h1 className="tp-title text-4xl leading-tight sm:text-5xl">
            {t.name}
          </h1>
          {t.organizer && (
            <p className="text-sm text-white/85">
              {tr("public.organizer", { name: t.organizer })}
            </p>
          )}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-white/90">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-4" />
              {formatDateRange(t.startDate, t.endDate, locale)}
            </span>
            {t.places.length > 0 && (
              <span className="flex items-center gap-1.5">
                <MapPin className="size-4" />
                {t.places.join(", ")}
              </span>
            )}
          </div>
          <p className="text-sm text-white/90">
            {tr(`modality.${t.modality}`)} · {tr(`format.${t.format}`)}
            {level && ` · ${level.label}`}
          </p>
        </div>
      </header>

      <main className="mx-auto -mt-5 max-w-3xl space-y-5 px-4 pb-16">
        <section className="tp-card grid grid-cols-2 gap-3 p-5 sm:grid-cols-3">
          <Stat
            label={tr("public.registered")}
            value={
              t.maxEntries
                ? tr("public.ofSpots", {
                    count: t.registeredCount,
                    max: t.maxEntries,
                  })
                : String(t.registeredCount)
            }
          />
          <Stat label={tr("public.waitlist")} value={String(t.waitlistCount)} />
          {t.registrationDeadline && (
            <Stat
              label={tr("public.deadline")}
              value={new Intl.DateTimeFormat(locale, {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(new Date(t.registrationDeadline))}
            />
          )}
        </section>

        {t.description && (
          <section className="tp-card whitespace-pre-line p-5 text-sm leading-6">
            {t.description}
          </section>
        )}

        {open ? (
          <RegistrationForm
            slug={t.slug}
            doubles={t.modality === "doubles"}
            full={
              t.maxEntries !== null &&
              t.registeredCount - t.waitlistCount >= t.maxEntries
            }
            organizer={t.organizer}
            levels={levelOptions(
              await loadSkillLevels().catch(() => []),
              t.sport
            )}
          />
        ) : (
          t.status === "closed" && (
            <p className="tp-card-soft p-4 text-sm font-semibold">
              {tr("public.closedNote")}
            </p>
          )
        )}

        {t.matches.length > 0 && (
          <PublicDraw
            format={t.format}
            matches={t.matches}
            entrants={[...t.entrants]}
          />
        )}

        <section className="space-y-3">
          <h2 className="tp-title flex items-center gap-2 text-2xl">
            <Users className="size-5 text-[#1a6db5]" />
            {tr("public.entrantsTitle")}
          </h2>
          {t.entrants.length === 0 ? (
            <p className="text-sm text-foreground/65">
              {tr("public.noEntrants")}
            </p>
          ) : (
            <ol className="tp-card divide-y divide-foreground/10">
              {t.entrants.map((name, i) => (
                <li key={`${name}-${i}`} className="flex gap-3 px-4 py-2.5">
                  <span className="w-6 text-right text-sm font-bold text-foreground/45">
                    {i + 1}
                  </span>
                  <span className="font-semibold">{name}</span>
                </li>
              ))}
            </ol>
          )}
          {t.waitlist.length > 0 && (
            <>
              <h3 className="pt-2 text-xs font-bold uppercase text-foreground/60">
                {tr("public.waitlist")} ({t.waitlist.length})
              </h3>
              <ol className="tp-card divide-y divide-foreground/10">
                {t.waitlist.map((name, i) => (
                  <li key={`${name}-${i}`} className="flex gap-3 px-4 py-2.5">
                    <span className="w-6 text-right text-sm font-bold text-[#1a6db5]">
                      #{i + 1}
                    </span>
                    <span>{name}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
        </section>

        <p className="pt-6 text-center text-[11px] text-foreground/45">
          {tr("public.poweredBy")}
        </p>
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase text-foreground/55">
        {label}
      </p>
      <p className="tp-title text-2xl">{value}</p>
    </div>
  );
}
