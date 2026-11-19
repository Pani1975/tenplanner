import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  Camera,
  CalendarDays,
  Lock,
  MapPin,
  Newspaper,
  Trophy,
  Users,
} from "lucide-react";
import { dmSans } from "@/app/fonts/dm-sans";
import { loadSkillLevels } from "@/lib/skill-levels-repo";
import {
  formatDateRange,
  STATUS_BADGE_ON_DARK,
} from "@/lib/tournaments/labels";
import { levelOptions } from "@/lib/tournaments/levels";
import type { PublicTournament } from "@/lib/tournaments/public";
import type { publishedNews, publishedPhotos } from "@/lib/tournaments/media";
import { cn } from "@/lib/utils";
import { PublicDraw } from "./public-draw";
import { PublicSchedule } from "./public-schedule";
import { RegistrationForm } from "./registration-form";

/**
 * Vista de solo lectura de un torneo (sin datos de contacto), compartida por
 * la página pública /t/<slug> y por el menú Torneos de familias y jugadores.
 * `withRegistration`: mostrar el formulario de inscripción por enlace.
 */
export async function TournamentView({
  t,
  withRegistration,
  top,
  notice,
  media,
}: {
  t: PublicTournament;
  withRegistration: boolean;
  top?: React.ReactNode;
  // Avisos al principio del contenido (p. ej. consentimientos pendientes).
  notice?: React.ReactNode;
  // Noticias y fotos publicadas (las fotos solo si quien mira puede verlas).
  media?: {
    news: Awaited<ReturnType<typeof publishedNews>>;
    photos: Awaited<ReturnType<typeof publishedPhotos>>;
  };
}) {
  const [tr, locale, levels] = await Promise.all([
    getTranslations("tournaments"),
    getLocale(),
    loadSkillLevels().catch(() => []),
  ]);
  const options = levelOptions(levels, t.sport);
  const level = t.levelCode
    ? options.find((l) => l.code === t.levelCode)
    : null;

  return (
    <div
      className={`${dmSans.variable} tp-torneos min-h-[100dvh] bg-background text-foreground`}
    >
      <header className="border-b border-white/10 bg-[#050505] px-5 pb-10 pt-6 text-white">
        <div className="mx-auto max-w-3xl space-y-3">
          {top}
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[11px] font-bold",
                STATUS_BADGE_ON_DARK[t.status]
              )}
            >
              {tr(`status.${t.status}`)}
            </span>
            {t.visibility === "private" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">
                <Lock className="size-3.5" />
                {tr("visibility.private")}
              </span>
            )}
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
        {notice}
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
          {t.registrationDeadline && t.status === "open" && (
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

        {withRegistration && t.acceptsRegistrations ? (
          <RegistrationForm
            slug={t.slug}
            doubles={t.modality === "doubles"}
            full={
              t.maxEntries !== null &&
              t.registeredCount - t.waitlistCount >= t.maxEntries
            }
            organizer={t.organizer}
            levels={options}
          />
        ) : (
          t.status === "closed" && (
            <p className="tp-card-soft p-4 text-sm font-semibold">
              {tr("public.closedNote")}
            </p>
          )
        )}

        {media && media.news.length > 0 && (
          <section className="space-y-3">
            <h2 className="tp-title flex items-center gap-2 text-2xl">
              <Newspaper className="size-5 text-[var(--brand-ink)]" />
              {tr("media.publicNewsTitle")}
            </h2>
            <ul className="space-y-3">
              {media.news.map((n) => (
                <li key={n.id} className="tp-card space-y-2 p-5">
                  <p className="tp-title text-lg">{n.title}</p>
                  <p className="text-xs text-foreground/60">
                    {tr(
                      `media.author.${n.authorType as "organizer" | "club"}`,
                      {
                        name: n.authorName,
                      }
                    )}
                    {n.publishedAt &&
                      ` · ${n.publishedAt.toLocaleDateString(locale, { day: "numeric", month: "long" })}`}
                  </p>
                  <p className="whitespace-pre-line text-sm leading-6">
                    {n.body}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {media && media.photos.length > 0 && (
          <section className="space-y-3">
            <h2 className="tp-title flex items-center gap-2 text-2xl">
              <Camera className="size-5 text-[var(--brand-ink)]" />
              {tr("media.publicPhotosTitle")}
            </h2>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {media.photos.map((p) => (
                <li key={p.id} className="overflow-hidden rounded-2xl">
                  <a href={p.url!} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url!}
                      alt={p.caption ?? tr("media.photoAlt")}
                      loading="lazy"
                      className="aspect-square w-full bg-foreground/5 object-cover"
                    />
                  </a>
                  {p.caption && (
                    <p className="px-1 pt-1 text-xs text-foreground/70">
                      {p.caption}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        {t.schedulePublished && (
          <PublicSchedule matches={t.matches} format={t.format} />
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
            <Users className="size-5 text-[var(--brand-ink)]" />
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
                    <span className="w-6 text-right text-sm font-bold text-[var(--brand-ink)]">
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
