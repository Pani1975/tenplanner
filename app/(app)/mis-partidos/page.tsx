import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight, Plus, Swords } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FamilyHeader } from "@/components/family/family-header";
import { listMatches, listMatchYears } from "@/lib/matches/server";
import {
  MATCH_TYPES,
  MATCH_TYPE_LABELS,
  isMatchType,
  rivalName,
} from "@/lib/matches/validation";
import { formatMatchDate } from "@/lib/matches/format";
import { cn } from "@/lib/utils";

export const metadata = { title: "Mis partidos" };

function filterHref(tipo: string | null, anio: number | null) {
  const p = new URLSearchParams();
  if (tipo) p.set("tipo", tipo);
  if (anio) p.set("anio", String(anio));
  const q = p.toString();
  return q ? `/mis-partidos?${q}` : "/mis-partidos";
}

function Chip({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 text-[13px] font-semibold transition-colors",
        active
          ? "border-[#050505] bg-[#050505] text-white dark:border-[#D6FF38] dark:bg-[#D6FF38] dark:text-[#050505]"
          : "border-[#050505]/10 bg-white text-foreground/70 hover:text-foreground dark:border-white/10 dark:bg-white/[0.045]"
      )}
    >
      {children}
    </Link>
  );
}

export default async function MisPartidosPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string; anio?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const sp = await searchParams;
  const tipo = isMatchType(sp.tipo) ? sp.tipo : null;
  const anioNum = Number(sp.anio);
  const anio = Number.isInteger(anioNum) && anioNum > 1900 ? anioNum : null;

  const [rows, years] = await Promise.all([
    listMatches(user.id, { type: tipo, year: anio }),
    listMatchYears(user.id),
  ]);
  const filtered = !!tipo || !!anio;

  return (
    <div className="tp-page">
      <div className="tp-page-pad space-y-6">
        <FamilyHeader
          icon={Swords}
          kicker="Jugador"
          title="Mis partidos"
          description="Tus torneos, partidos oficiales, amistosos y entrenamientos. Solo los ves tú."
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/mis-partidos/nuevo"
            className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-black text-brand-foreground hover:bg-brand/90"
          >
            <Plus className="size-4" />
            Añadir partido
          </Link>
        </div>

        <nav aria-label="Filtros" className="space-y-2">
          <div className="flex flex-wrap gap-2">
            <Chip href={filterHref(null, anio)} active={!tipo}>
              Todos
            </Chip>
            {MATCH_TYPES.map((t) => (
              <Chip key={t} href={filterHref(t, anio)} active={tipo === t}>
                {MATCH_TYPE_LABELS[t]}
              </Chip>
            ))}
          </div>
          {years.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Chip href={filterHref(tipo, null)} active={!anio}>
                Todos los años
              </Chip>
              {years.map((y) => (
                <Chip key={y} href={filterHref(tipo, y)} active={anio === y}>
                  {y}
                </Chip>
              ))}
            </div>
          )}
        </nav>

        {rows.length === 0 ? (
          <div className="tp-panel flex flex-col items-center gap-3 border-dashed py-16 text-center">
            <Swords className="size-8 text-foreground/30" />
            <p className="max-w-sm text-sm leading-6 text-foreground/60">
              {filtered
                ? "No hay partidos con estos filtros."
                : "Aún no has añadido ningún partido. Empieza por el último que hayas jugado."}
            </p>
          </div>
        ) : (
          <ul className="tp-panel divide-y divide-[#050505]/8 overflow-hidden p-0 dark:divide-white/10">
            {rows.map((m) => {
              const rival = rivalName(m);
              return (
                <li key={m.id}>
                  <Link
                    href={`/mis-partidos/${m.id}`}
                    className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-foreground/[0.03]"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-ink">
                          {MATCH_TYPE_LABELS[m.matchType]}
                        </span>
                        <span className="text-xs font-semibold text-foreground/55">
                          {formatMatchDate(m.matchDate)}
                        </span>
                      </div>
                      <p className="mt-1 truncate text-sm font-semibold text-foreground">
                        {[m.tournamentName, rival ? `vs ${rival}` : null]
                          .filter(Boolean)
                          .join(" · ") || "Sin rival indicado"}
                      </p>
                    </div>
                    {m.finalResult && (
                      <span className="shrink-0 font-mono text-sm font-bold tabular-nums text-foreground">
                        {m.finalResult}
                      </span>
                    )}
                    <ChevronRight className="size-4 shrink-0 text-foreground/35" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
