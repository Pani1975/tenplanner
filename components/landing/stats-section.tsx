import { useTranslations } from "next-intl";
import { CalendarCheck, Layers3, Tags, type LucideIcon } from "lucide-react";

import type { LandingStats } from "@/lib/landing-stats";
import { CountUp } from "./count-up";
import { RevealItem, RevealStagger } from "./landing-reveal";

// Etiquetas reales de los filtros, solo para ilustrar la tarjeta.
const SAMPLE_TAG_KEYS = [
  "technique", "tactics", "volley", "serve", "topspin", "red", "doubles",
  "rally", "defense", "pointPlay", "cooperative", "time", "group", "mainPart",
] as const;

function DotGrid() {
  // 7 filas x 14 columnas de "pelotas": el conjunto transmite volumen.
  return (
    <div
      aria-hidden
      className="grid gap-1.5"
      style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}
    >
      {Array.from({ length: 98 }, (_, i) => {
        // Algunas pelotas en verde de marca: lima y oliva.
        const lime = i % 4 === 0;
        const olive = !lime && i % 7 === 3;
        return (
          <span
            key={i}
            className={
              lime
                ? "aspect-square rounded-full bg-[#d6ff38] ring-1 ring-[#5f7000]/40"
                : olive
                  ? "aspect-square rounded-full bg-[#5f7000]"
                  : "aspect-square rounded-full bg-[#050505]"
            }
            style={
              lime || olive
                ? undefined
                : { opacity: 0.18 + ((i * 37) % 83) / 100 }
            }
          />
        );
      })}
    </div>
  );
}

function ClassStack() {
  const rows = [86, 64, 92, 48, 74, 58];
  return (
    <div aria-hidden className="grid gap-2">
      {rows.map((w, i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl bg-[#050505]/[0.07] px-3 py-2.5"
        >
          <span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#050505] text-[10px] font-bold text-[#d6ff38]">
            {i + 1}
          </span>
          <span
            className="h-2 rounded-full bg-[#050505]"
            style={{ width: `${w}%`, opacity: 0.8 - i * 0.1 }}
          />
        </div>
      ))}
    </div>
  );
}

function TagCloud() {
  const t = useTranslations("landing.stats.tags");
  return (
    <div aria-hidden className="flex flex-wrap gap-1.5">
      {SAMPLE_TAG_KEYS.map((tag, i) => (
        <span
          key={tag}
          className={
            i % 3 === 0
              ? "rounded-full bg-[#050505] px-3 py-1 text-xs font-semibold text-[#d6ff38]"
              : "rounded-full border border-[#050505]/25 px-3 py-1 text-xs font-semibold text-[#050505]/75"
          }
        >
          {t(tag)}
        </span>
      ))}
    </div>
  );
}

type Card = {
  icon: LucideIcon;
  value: number;
  label: string;
  text: string;
  visual: React.ReactNode;
};

export function StatsSection({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing.stats");
  const cards: Card[] = [
    {
      icon: Layers3,
      value: stats.exercises,
      label: t("exercises.label"),
      text: t("exercises.text"),
      visual: <DotGrid />,
    },
    {
      icon: CalendarCheck,
      value: stats.classes,
      label: t("classes.label"),
      text: t("classes.text"),
      visual: <ClassStack />,
    },
    {
      icon: Tags,
      value: stats.tags,
      label: t("tagsCard.label"),
      text: t("tagsCard.text"),
      visual: <TagCloud />,
    },
  ];

  return (
    <section
      aria-label={t("eyebrow")}
      className="relative overflow-hidden bg-[#e8e8e1] px-5 py-20 text-[#050505] lg:py-28"
    >
      <div className="mx-auto max-w-[1240px]">
        <p className="text-center text-[12px] font-semibold uppercase tracking-[0.28em] text-[#050505]/60">
          {t("eyebrow")}
        </p>
        <h2 className="mx-auto mt-5 max-w-3xl text-center font-heading text-[clamp(2.2rem,4.4vw,3.9rem)] font-bold leading-[0.97]">
          {t("title1")}
          <span className="block font-light italic text-[#050505]/55">
            {t("title2")}
          </span>
        </h2>

        <RevealStagger className="mt-14 grid gap-5 md:grid-cols-3">
          {cards.map(({ icon: Icon, value, label, text, visual }) => (
            <RevealItem key={label} className="h-full">
              <article className="flex h-full flex-col rounded-[28px] bg-white p-7 shadow-[0_18px_45px_rgba(5,5,5,0.08)] ring-1 ring-[#050505]/10 lg:p-8">
                <span className="grid size-11 place-items-center rounded-xl bg-[#050505] text-[#d6ff38]">
                  <Icon className="size-5" />
                </span>
                <p className="mt-6 flex items-baseline gap-2">
                  <CountUp
                    value={value}
                    className="font-heading text-[clamp(4rem,7vw,6.25rem)] font-bold leading-none tracking-tight tabular-nums"
                  />
                </p>
                <p className="mt-2 font-heading text-xl font-bold">{label}</p>
                <p className="mt-2 text-sm leading-6 text-[#050505]/65">
                  {text}
                </p>
                <div className="mt-auto pt-7">{visual}</div>
              </article>
            </RevealItem>
          ))}
        </RevealStagger>
      </div>
    </section>
  );
}
