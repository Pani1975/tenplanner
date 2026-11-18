"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, useScroll, useTransform } from "motion/react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

const sections = [
  { id: "hero", label: "Inicio", href: "#" },
  { id: "sistema", label: "Cómo funciona", href: "#sistema" },
  { id: "biblioteca", label: "Biblioteca", href: "#biblioteca" },
  { id: "planes", label: "Planes", href: "#planes" },
  { id: "crear-cuenta", label: "Crear cuenta", href: "#crear-cuenta" },
];

export function FloatingSidebar() {
  const tx = useTranslations("ui.s_landing_floatingsidebar");
  const [active, setActive] = useState<string>("hero");
  const [hovered, setHovered] = useState(false);
  const { scrollYProgress } = useScroll();
  const progressHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  useEffect(() => {
    const elements = sections
      .map((s) => document.getElementById(s.id))
      .filter(Boolean) as HTMLElement[];

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActive(entry.target.id);
          }
        }
      },
      { rootMargin: "-40% 0px -40% 0px", threshold: 0 }
    );

    elements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const activeIndex = sections.findIndex((s) => s.id === active);

  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.7, delay: 1.1, ease: [0.16, 1, 0.3, 1] }}
      className="fixed right-5 top-1/2 z-50 hidden -translate-y-1/2 xl:flex"
      aria-label={tx("navegacionDeSecciones")}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <motion.div
        animate={{ width: hovered ? 176 : 44 }}
        transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex flex-col gap-0.5 overflow-hidden rounded-[1.25rem] border border-border/60 bg-background/88 p-2 shadow-[0_4px_28px_color-mix(in_oklab,var(--foreground)_8%,transparent),0_1px_3px_color-mix(in_oklab,var(--foreground)_4%,transparent)] backdrop-blur-2xl"
      >
        {/* Scroll progress track */}
        <div
          aria-hidden
          className="absolute left-[1.375rem] w-px overflow-hidden"
          style={{ top: "2.75rem", bottom: "4.75rem" }}
        >
          {/* Track base */}
          <div className="absolute inset-0 bg-border/40" />
          {/* Progress fill */}
          <motion.div
            style={{ height: progressHeight }}
            className="absolute top-0 w-full bg-brand/50"
          />
          {/* Active indicator */}
          <motion.div
            animate={{
              top: `${activeIndex >= 0 ? (activeIndex / (sections.length - 1)) * 100 : 0}%`,
            }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -left-[3px] size-[7px] rounded-full bg-brand shadow-[0_0_0_2px_color-mix(in_oklab,var(--brand)_20%,transparent)]"
            style={{ transform: "translateY(-50%)" }}
          />
        </div>

        {/* Section links */}
        {sections.map(({ id, label, href }) => {
          const isActive = active === id;
          return (
            <Link
              key={id}
              href={href}
              className={cn(
                "group relative flex h-9 shrink-0 items-center gap-3 rounded-xl px-2 transition-colors duration-200",
                isActive ? "bg-brand/10" : "hover:bg-muted/50"
              )}
            >
              {/* Dot */}
              <span
                className={cn(
                  "relative z-10 block size-2.5 shrink-0 rounded-full transition-all duration-300",
                  isActive
                    ? "scale-110 bg-brand shadow-[0_0_0_3px_color-mix(in_oklab,var(--brand)_22%,transparent)]"
                    : "bg-foreground/20 group-hover:bg-foreground/40"
                )}
              />

              {/* Label */}
              <motion.span
                animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : -6 }}
                transition={{ duration: 0.22, delay: hovered ? 0.04 : 0 }}
                className={cn(
                  "whitespace-nowrap text-sm font-medium",
                  isActive
                    ? "text-brand"
                    : "text-muted-foreground group-hover:text-foreground"
                )}
              >
                {label}
              </motion.span>
            </Link>
          );
        })}

        {/* Divider */}
        <div className="mx-2 my-1 h-px bg-border/50" />

        {/* CTA */}
        <Link
          href="/register"
          className="group relative flex h-9 shrink-0 items-center gap-3 overflow-hidden rounded-xl bg-brand px-2 text-brand-foreground transition-colors duration-200 hover:bg-foreground hover:text-background"
        >
          <span className="relative z-10 grid size-2.5 shrink-0 place-items-center">
            <ArrowRight className="size-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
          </span>
          <motion.span
            animate={{ opacity: hovered ? 1 : 0, x: hovered ? 0 : -6 }}
            transition={{ duration: 0.22, delay: hovered ? 0.06 : 0 }}
            className="whitespace-nowrap text-sm font-semibold"
          >
            {tx("crearCuenta")}
          </motion.span>
        </Link>
      </motion.div>
    </motion.aside>
  );
}
