// Vistas Semana, Mes y Año de Reservas de pistas (componentes de servidor).
// Cada día enlaza a la vista Día, que tiene la rejilla por horas.

import Link from "next/link";
import { minutesLabel } from "@/lib/bookings/availability";
import type { OccupancyItem, OccupancyKind } from "@/lib/bookings/occupancy";
import { cn } from "@/lib/utils";

export const KIND_CHIP: Record<OccupancyKind, string> = {
  session: "border-brand/60 bg-brand/25",
  booking: "border-amber-500/60 bg-amber-400/25",
  club: "border-violet-500/60 bg-violet-500/20",
  tournament: "border-[#a8c22a] bg-[#d6f04a]/40",
};
const KIND_DOT: Record<OccupancyKind, string> = {
  session: "bg-brand",
  booking: "bg-amber-400",
  club: "bg-violet-500",
  tournament: "bg-[#d6f04a]",
};

export function shiftDay(dateStr: string, days: number) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
const utc = (d: string) => new Date(`${d}T00:00:00Z`);
/** Lunes de la semana del día. */
export function mondayOf(dateStr: string) {
  return shiftDay(dateStr, -((utc(dateStr).getUTCDay() + 6) % 7));
}
const dayHref = (d: string) => `/reservas-pistas?vista=dia&dia=${d}`;

function itemHref(i: OccupancyItem) {
  if (i.kind === "session") return `/sessions/${i.id}`;
  if (i.kind === "tournament") return `/torneos/${i.id}`;
  return null;
}

function Chip({
  item,
  term,
}: {
  item: OccupancyItem;
  term: (s: string) => string;
}) {
  const body = (
    <>
      <span className="tabular-nums opacity-70">
        {minutesLabel(item.startMinute)}
      </span>{" "}
      <span className="font-semibold">{term(item.label)}</span>
    </>
  );
  const cls = cn(
    "block truncate rounded-md border px-1.5 py-0.5 text-[11px] leading-tight text-foreground",
    KIND_CHIP[item.kind]
  );
  const href = itemHref(item);
  return href ? (
    <Link href={href} className={cn(cls, "hover:opacity-80")} title={item.label}>
      {body}
    </Link>
  ) : (
    <span className={cls} title={item.label}>
      {body}
    </span>
  );
}

/** Semana: una fila por pista y una columna por día. */
export function WeekView({
  weekStart,
  today,
  places,
  items,
  locale,
  moreLabel,
  term,
}: {
  weekStart: string;
  today: string;
  places: { id: string; name: string }[];
  items: OccupancyItem[];
  locale: string;
  moreLabel: (n: number) => string;
  term: (s: string) => string;
}) {
  const days = Array.from({ length: 7 }, (_, i) => shiftDay(weekStart, i));
  const head = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const MAX = 4;
  return (
    <div className="overflow-x-auto rounded-2xl border border-border bg-card">
      <div
        className="grid min-w-max"
        style={{
          gridTemplateColumns: `7.5rem repeat(7, minmax(8.5rem, 1fr))`,
        }}
      >
        <div className="sticky left-0 z-10 border-b border-border bg-card" />
        {days.map((d) => (
          <Link
            key={d}
            href={dayHref(d)}
            className={cn(
              "border-b border-l border-border px-2 py-2 text-center text-xs font-bold capitalize hover:bg-muted",
              d === today && "text-brand"
            )}
          >
            {head.format(utc(d)).replace(".", "")}
          </Link>
        ))}
        {places.map((p) => (
          <div key={p.id} className="contents">
            <div className="sticky left-0 z-10 flex items-start border-b border-border bg-card px-2 py-2 text-sm font-bold">
              <span className="truncate">{p.name}</span>
            </div>
            {days.map((d) => {
              const cell = items.filter(
                (i) => i.placeId === p.id && i.date === d
              );
              return (
                <div
                  key={d}
                  className={cn(
                    "min-h-16 space-y-1 border-b border-l border-border p-1",
                    d === today && "bg-brand/5"
                  )}
                >
                  {cell.slice(0, MAX).map((i) => (
                    <Chip key={i.key} item={i} term={term} />
                  ))}
                  {cell.length > MAX && (
                    <Link
                      href={dayHref(d)}
                      className="block px-1 text-[11px] font-semibold text-foreground/60 underline"
                    >
                      {moreLabel(cell.length - MAX)}
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Mes: rejilla de lunes a domingo; cada día con lo que ocupa las pistas. */
export function MonthView({
  monthStart,
  today,
  items,
  placeNames,
  locale,
  moreLabel,
  term,
}: {
  monthStart: string;
  today: string;
  items: OccupancyItem[];
  placeNames: Map<string, string>;
  locale: string;
  moreLabel: (n: number) => string;
  term: (s: string) => string;
}) {
  const month = monthStart.slice(0, 7);
  const first = mondayOf(monthStart);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const row = Array.from({ length: 7 }, (_, i) => shiftDay(first, w * 7 + i));
    if (w > 0 && row[0].slice(0, 7) !== month) break;
    weeks.push(row);
  }
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  const byDay = new Map<string, OccupancyItem[]>();
  for (const i of items) {
    const list = byDay.get(i.date) ?? [];
    list.push(i);
    byDay.set(i.date, list);
  }
  const MAX = 3;
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border">
        {weeks[0].map((d) => (
          <div
            key={d}
            className="px-1 py-2 text-center text-[11px] font-bold uppercase text-muted-foreground"
          >
            {weekday.format(utc(d)).replace(".", "")}
          </div>
        ))}
      </div>
      {weeks.map((row) => (
        <div key={row[0]} className="grid grid-cols-7">
          {row.map((d) => {
            const list = byDay.get(d) ?? [];
            const kinds = (
              ["session", "booking", "club", "tournament"] as const
            ).filter((k) => list.some((i) => i.kind === k));
            const out = d.slice(0, 7) !== month;
            return (
              <div
                key={d}
                className={cn(
                  "min-h-20 border-b border-l border-border p-1 first:border-l-0 sm:min-h-28",
                  out && "bg-muted/30 text-muted-foreground"
                )}
              >
                <Link
                  href={dayHref(d)}
                  className={cn(
                    "mb-1 inline-grid size-6 place-items-center rounded-full text-xs font-black hover:bg-muted",
                    d === today && "bg-foreground text-background hover:bg-foreground"
                  )}
                >
                  {utc(d).getUTCDate()}
                </Link>
                {/* Móvil: solo puntos por tipo y el total. */}
                {list.length > 0 && (
                  <Link
                    href={dayHref(d)}
                    className="flex items-center gap-1 sm:hidden"
                  >
                    {kinds.map((k) => (
                      <span key={k} className={cn("size-2 rounded-full", KIND_DOT[k])} />
                    ))}
                    <span className="text-[10px] font-bold">{list.length}</span>
                  </Link>
                )}
                <div className="hidden space-y-1 sm:block">
                  {list.slice(0, MAX).map((i) => (
                    <Chip
                      key={i.key}
                      item={{
                        ...i,
                        label: `${placeNames.get(i.placeId) ?? ""} · ${term(i.label)}`,
                      }}
                      term={(s) => s}
                    />
                  ))}
                  {list.length > MAX && (
                    <Link
                      href={dayHref(d)}
                      className="block px-1 text-[11px] font-semibold text-foreground/60 underline"
                    >
                      {moreLabel(list.length - MAX)}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Año: los 12 meses en pequeño; cada día coloreado según cuánto se usan las
 * pistas (horas ocupadas frente a las horas abiertas de todas las pistas).
 */
export function YearView({
  year,
  today,
  items,
  capacityMinutes,
  locale,
  monthHref,
}: {
  year: number;
  today: string;
  items: OccupancyItem[];
  /** Minutos abiertos al día sumando todas las pistas. */
  capacityMinutes: number;
  locale: string;
  monthHref: (monthStart: string) => string;
}) {
  const used = new Map<string, number>();
  for (const i of items) used.set(i.date, (used.get(i.date) ?? 0) + i.minutes);
  const level = (d: string) => {
    const m = used.get(d) ?? 0;
    if (!m) return 0;
    const r = m / Math.max(capacityMinutes, 60);
    return r < 0.15 ? 1 : r < 0.35 ? 2 : r < 0.6 ? 3 : 4;
  };
  const LEVEL = ["", "bg-brand/20", "bg-brand/45", "bg-brand/70", "bg-brand"];
  const monthName = new Intl.DateTimeFormat(locale, {
    month: "long",
    timeZone: "UTC",
  });
  const weekday = new Intl.DateTimeFormat(locale, {
    weekday: "narrow",
    timeZone: "UTC",
  });
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 12 }, (_, m) => {
        const start = `${year}-${String(m + 1).padStart(2, "0")}-01`;
        const month = start.slice(0, 7);
        const first = mondayOf(start);
        const cells = Array.from({ length: 42 }, (_, i) => shiftDay(first, i));
        const rows = cells.length / 7;
        return (
          <div key={m} className="rounded-2xl border border-border bg-card p-2 sm:p-3">
            <Link
              href={monthHref(start)}
              className="mb-2 block text-sm font-black capitalize hover:underline"
            >
              {monthName.format(utc(start))}
            </Link>
            <div className="grid grid-cols-7 gap-0.5 text-center">
              {cells.slice(0, 7).map((d) => (
                <span key={d} className="text-[9px] font-bold uppercase text-muted-foreground">
                  {weekday.format(utc(d))}
                </span>
              ))}
              {Array.from({ length: rows }).flatMap((_, r) =>
                cells.slice(r * 7, r * 7 + 7).map((d) =>
                  d.slice(0, 7) !== month ? (
                    <span key={`${r}-${d}`} />
                  ) : (
                    <Link
                      key={d}
                      href={dayHref(d)}
                      title={
                        used.get(d)
                          ? `${Math.round((used.get(d) ?? 0) / 6) / 10} h`
                          : undefined
                      }
                      className={cn(
                        "grid aspect-square place-items-center rounded text-[9px] tabular-nums hover:ring-1 hover:ring-foreground/40 sm:text-[10px]",
                        LEVEL[level(d)],
                        level(d) === 4 && "text-brand-foreground",
                        d === today && "ring-2 ring-foreground"
                      )}
                    >
                      {utc(d).getUTCDate()}
                    </Link>
                  )
                )
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function YearLegend({
  less,
  more,
}: {
  less: string;
  more: string;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      {less}
      {["bg-brand/20", "bg-brand/45", "bg-brand/70", "bg-brand"].map((c) => (
        <span key={c} className={cn("size-2.5 rounded-sm", c)} />
      ))}
      {more}
    </span>
  );
}
