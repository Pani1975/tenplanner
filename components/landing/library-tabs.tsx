"use client";

import Link from "next/link";
import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import {
  ClipboardList,
  Clock3,
  Dumbbell,
  Layers3,
  Trophy,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { nivelLabel } from "@/lib/exercise-taxonomy";

export type LandingExerciseCard = {
  id: string;
  name: string;
  durationMinutes: number;
  nivel: string | null;
  aspectoJuego: string | null;
};

export type LandingClassCard = {
  id: string;
  name: string;
  duracionMinutes: number;
  nivel: string | null;
  objetivos: string | null;
  numAlumnos: number | null;
};

type LibraryPreview = {
  href: string;
  title: string;
  top: string;
  tag: string;
  level: string;
  time: string;
  icon: LucideIcon;
};

type Tab = "exercises" | "classes";

const ease = [0.16, 1, 0.3, 1] as const;

const tabs: Array<{
  id: Tab;
  label: string;
  cta: { href: string; label: string };
}> = [
  {
    id: "exercises",
    label: "Ejercicios",
    cta: { href: "/exercises", label: "Ver todos los ejercicios" },
  },
  {
    id: "classes",
    label: "Clases completas",
    cta: { href: "/classes", label: "Ver todas las clases" },
  },
];

const cardStyles = [
  {
    top: "bg-[#20201c]",
    exerciseIcon: Dumbbell,
    classIcon: Layers3,
  },
  {
    top: "bg-[#2b3613]",
    exerciseIcon: Clock3,
    classIcon: ClipboardList,
  },
  {
    top: "bg-[#3a3a34]",
    exerciseIcon: Trophy,
    classIcon: Trophy,
  },
];

function cleanLabel(value: string | null, fallback: string) {
  if (!value) return fallback;
  return value.replace(/_/g, " ");
}

/** Nivel con su nombre bonito ("Precompetición", no "precompeticion"). */
function levelLabel(value: string | null, fallback: string) {
  return value ? nivelLabel(value) : fallback;
}

function buildExerciseCards(cards: LandingExerciseCard[]): LibraryPreview[] {
  return cards.slice(0, 3).map((card, index) => {
    const style = cardStyles[index] ?? cardStyles[0];

    return {
      href: `/exercises/${card.id}`,
      title: card.name,
      top: style.top,
      tag: cleanLabel(card.aspectoJuego, "Biblioteca"),
      level: levelLabel(card.nivel, "Todos"),
      time: `${card.durationMinutes} min`,
      icon: style.exerciseIcon,
    };
  });
}

function buildClassCards(cards: LandingClassCard[]): LibraryPreview[] {
  return cards.slice(0, 3).map((card, index) => {
    const style = cardStyles[index] ?? cardStyles[0];

    return {
      href: `/classes/${card.id}`,
      title: card.name,
      top: style.top,
      tag: "Clase",
      level: levelLabel(card.nivel, `${card.numAlumnos ?? "Grupo"} alumnos`),
      time: `${card.duracionMinutes} min`,
      icon: style.classIcon,
    };
  });
}

function PreviewCard({ item }: { item: LibraryPreview }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className="block overflow-hidden rounded-xl border border-white/10 bg-white/[0.045] transition hover:-translate-y-1 hover:border-white/18"
    >
      <div className={cn("grid h-[120px] place-items-center", item.top)}>
        <Icon className="size-10 text-[#d6ff38]" strokeWidth={1.7} />
      </div>
      <div className="p-4">
        <h3 className="min-h-10 text-base font-bold leading-5 text-white">
          {item.title}
        </h3>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-[#d6ff38]">
            {item.tag}
          </span>
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/55">
            {item.level}
          </span>
          <span className="rounded-full bg-white/8 px-3 py-1 text-xs font-semibold text-white/55">
            {item.time}
          </span>
        </div>
      </div>
    </Link>
  );
}

export function LibrarySection({
  exerciseCards,
  classCards,
}: {
  exerciseCards: LandingExerciseCard[];
  classCards: LandingClassCard[];
}) {
  const [tab, setTab] = useState<Tab>("exercises");
  const reduced = useReducedMotion();

  const items =
    tab === "exercises"
      ? buildExerciseCards(exerciseCards)
      : buildClassCards(classCards);
  const active = tabs.find((t) => t.id === tab) ?? tabs[0];

  return (
    <section className="bg-[#050505] px-5 py-24 text-white lg:py-32">
      <div className="mx-auto max-w-[1100px]">
        <p className="text-[12px] font-semibold uppercase tracking-[0.25em] text-white/45">
          Contenido real de tenis
        </p>
        <h2 className="mt-6 font-heading text-[clamp(2.5rem,4.4vw,4.25rem)] font-bold leading-[0.95]">
          Ejercicios y clases
          <span className="block font-heading font-light italic text-white/45">
            creados por expertos
          </span>
        </h2>

        <div
          role="tablist"
          aria-label="Tipo de contenido"
          className="mt-12 inline-flex rounded-full bg-white/8 p-1"
        >
          {tabs.map((t) => {
            const isActive = t.id === tab;
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setTab(t.id)}
                className={cn(
                  "rounded-full px-6 py-2 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#d6ff38]",
                  isActive
                    ? "bg-[#d6ff38] text-[#050505]"
                    : "text-white/62 hover:text-white"
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {items.length > 0 ? (
          <motion.div
            key={tab}
            initial={reduced ? false : "hidden"}
            animate="visible"
            variants={{
              hidden: {},
              visible: {
                transition: { staggerChildren: 0.07, delayChildren: 0.05 },
              },
            }}
            className="mt-9 grid gap-4 md:grid-cols-3"
          >
            {items.map((item) => (
              <motion.div
                key={item.href}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: {
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.5, ease },
                  },
                }}
              >
                <PreviewCard item={item} />
              </motion.div>
            ))}
          </motion.div>
        ) : (
          <div className="mt-9 rounded-xl border border-white/10 bg-white/[0.045] px-5 py-8 text-sm font-semibold text-white/55">
            Aún no hay contenido visible en esta biblioteca.
          </div>
        )}

        <div className="mt-12 flex justify-center">
          <Link
            href={active.cta.href}
            className="rounded-full border border-white/18 bg-white/8 px-7 py-4 text-sm font-bold text-white transition hover:bg-white hover:text-[#050505]"
          >
            {active.cta.label} →
          </Link>
        </div>
      </div>
    </section>
  );
}
