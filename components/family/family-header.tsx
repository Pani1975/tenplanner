import Link from "next/link";
import type { FamilyPlayer } from "@/lib/family-data";
import { cn } from "@/lib/utils";

/** Cabecera común del panel de familias. */
export function FamilyHeader({
  icon: Icon,
  kicker,
  title,
  description,
}: {
  icon: React.ElementType;
  kicker: string;
  title: string;
  description: string;
}) {
  return (
    <header className="tp-hero-panel p-6 text-white sm:p-8">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
        <Icon className="size-3.5" />
        {kicker}
      </div>
      <h1 className="text-4xl font-black leading-tight sm:text-5xl">{title}</h1>
      <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
        {description}
      </p>
    </header>
  );
}

/** Selector de jugador (solo si la familia tiene más de uno). */
export function PlayerSwitcher({
  players,
  current,
  basePath,
}: {
  players: FamilyPlayer[];
  current: string;
  basePath: string;
}) {
  if (players.length < 2) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[#050505]/10 bg-white p-2 dark:border-white/10 dark:bg-white/[0.045]">
      <span className="pl-2 text-[11px] font-bold uppercase tracking-wide text-foreground/45">
        Jugador
      </span>
      {players.map((p) => (
        <Link
          key={p.studentId}
          href={`${basePath}?alumno=${p.studentId}`}
          className={cn(
            "inline-flex h-8 items-center rounded-full px-3 text-[13px] font-semibold transition-colors",
            p.studentId === current
              ? "bg-[#050505] text-white dark:bg-[#D6FF38] dark:text-[#050505]"
              : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground"
          )}
        >
          {p.name}
        </Link>
      ))}
    </div>
  );
}

/** Estado vacío: la cuenta aún no está vinculada a ningún jugador. */
export function NoPlayers() {
  return (
    <div className="tp-panel flex flex-col items-center justify-center gap-3 border-dashed py-16 text-center">
      <p className="max-w-sm text-sm leading-6 text-foreground/60">
        Tu cuenta todavía no está vinculada a ningún jugador. Cuando el club te
        envíe el enlace de invitación y lo actives, aparecerá aquí.
      </p>
    </div>
  );
}
