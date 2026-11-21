import Link from "next/link";
import { notFound } from "next/navigation";
import { Trophy } from "lucide-react";
import { dmSans } from "@/app/fonts/dm-sans";
import { getPublicPlayerProfile } from "@/lib/players/server";
import { handLabel, shotLabel } from "@/lib/players/profile";
import { MATCH_TYPE_LABELS } from "@/lib/matches/validation";
import { formatMatchDate } from "@/lib/matches/format";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

// Perfil de una persona: se comparte por enlace, pero no se indexa.
export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const p = await getPublicPlayerProfile(slug);
  return {
    title: p ? `${p.name} · Jugador` : "Perfil no disponible",
    robots: { index: false, follow: false },
  };
}

function Stat({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="rounded-lg border border-[#050505]/10 bg-white p-3 dark:border-white/10 dark:bg-white/[0.045]">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-foreground/50">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

/** Perfil público del jugador: /j/<slug>. Nunca muestra rivales ni la fecha de nacimiento. */
export default async function PublicPlayerPage({ params }: Props) {
  const { slug } = await params;
  const p = await getPublicPlayerProfile(slug);
  if (!p) notFound();

  const initials = p.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  return (
    <div className={`${dmSans.variable} min-h-[100dvh] bg-background text-foreground`}>
      <header className="bg-[#050505] px-5 pb-10 pt-6 text-white">
        <div className="mx-auto flex max-w-3xl flex-col gap-5 sm:flex-row sm:items-center">
          {p.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={p.photoUrl}
              alt={p.name}
              className="size-24 shrink-0 rounded-full object-cover ring-4 ring-[#D6FF38]"
            />
          ) : (
            <div className="grid size-24 shrink-0 place-items-center rounded-full bg-[#D6FF38] text-3xl font-black text-[#050505]">
              {initials}
            </div>
          )}
          <div className="space-y-2">
            {p.category && (
              <span className="inline-flex rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
                {p.category}
              </span>
            )}
            <h1 className="text-4xl font-black leading-tight sm:text-5xl">{p.name}</h1>
            {p.clubName && (
              <p className="text-sm font-semibold text-white/65">
                Club: {p.clubName}{" "}
                <span className="text-white/45">(indicado por el jugador)</span>
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-5 py-8">
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label="Mano" value={handLabel(p.dominantHand)} />
          <Stat label="Golpe preferido" value={shotLabel(p.favoriteShot)} />
          <Stat
            label="Empezó a jugar"
            value={p.startedAge != null ? `A los ${p.startedAge} años` : null}
          />
          <Stat label="Tenista preferido" value={p.favoritePlayer} />
          <Stat label="Lugar de nacimiento" value={p.birthPlace} />
        </dl>

        <section className="space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-black">
            <Trophy className="size-5" />
            Partidos
          </h2>
          {p.matches.length === 0 ? (
            <p className="text-sm text-foreground/60">
              Todavía no hay partidos publicados.
            </p>
          ) : (
            <ul className="divide-y divide-[#050505]/8 overflow-hidden rounded-lg border border-[#050505]/10 bg-white dark:divide-white/10 dark:border-white/10 dark:bg-white/[0.045]">
              {p.matches.map((m) => (
                <li key={m.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {m.tournamentName ?? MATCH_TYPE_LABELS[m.matchType]}
                    </p>
                    <p className="text-xs text-foreground/55">
                      {MATCH_TYPE_LABELS[m.matchType]} · {formatMatchDate(m.matchDate)}
                    </p>
                  </div>
                  {m.finalResult && (
                    <span className="shrink-0 font-mono text-sm font-bold tabular-nums">
                      {m.finalResult}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-xs text-foreground/50">
          Perfil creado con{" "}
          <Link href="/" className="font-semibold underline">
            Ten Planner
          </Link>
        </p>
      </main>
    </div>
  );
}
