"use client";

import { motion } from "motion/react";
import { AlertTriangle, Sparkles, BarChart3, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

export type InsightItem = {
  tipo: "alerta" | "sugerencia" | "stat";
  titulo: string;
  detalle: string;
  metric?: string;
  accion?: { label: string; prompt: string };
};

const TIPO_STYLES: Record<
  InsightItem["tipo"],
  { icon: typeof AlertTriangle; accent: string; label: string }
> = {
  alerta: {
    icon: AlertTriangle,
    accent: "text-amber-600 border-amber-500/40 bg-amber-500/[0.06]",
    label: "Alerta",
  },
  sugerencia: {
    icon: Sparkles,
    accent: "text-brand border-brand/40 bg-brand/[0.06]",
    label: "Sugerencia",
  },
  stat: {
    icon: BarChart3,
    accent: "text-foreground/80 border-foreground/20 bg-foreground/[0.03]",
    label: "Stat",
  },
};

export function InsightsPanel({
  part,
  onSend,
}: {
  part: { state: string; output?: unknown };
  onSend: (text: string) => void;
}) {
  const tx = useTranslations("ui.s_drplanner_insightspanel");
  if (part.state !== "output-available") {
    return (
      <div className="border-l-2 border-brand/30 bg-foreground/[0.02] px-4 py-6 space-y-2">
        <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/55">
          {tx("analizandoTuAcademia")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-20 border border-foreground/10 bg-foreground/[0.03] animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  const data = part.output as { titulo?: string; items: InsightItem[] };
  if (!data?.items?.length) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="border-l-2 border-brand/50 bg-foreground/[0.02] px-4 py-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <p className="font-sans text-[10px] uppercase tracking-[0.28em] text-foreground/55">
          {data.titulo ?? "Insights"}
        </p>
        <span className="font-sans text-[10px] tabular-nums tracking-[0.22em] text-foreground/40">
          {String(data.items.length).padStart(2, "0")}
        </span>
      </div>
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.06 } },
        }}
        className="grid grid-cols-1 sm:grid-cols-2 gap-2"
      >
        {data.items.map((item, i) => {
          const style = TIPO_STYLES[item.tipo];
          const Icon = style.icon;
          return (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, y: 6 },
                show: { opacity: 1, y: 0 },
              }}
              className={cn(
                "group relative border p-3.5 flex flex-col gap-2",
                style.accent
              )}
            >
              <div className="flex items-start gap-2">
                <Icon className="size-3.5 shrink-0 mt-0.5" strokeWidth={1.6} />
                <div className="flex-1 min-w-0">
                  <p className="font-sans text-[9px] uppercase tracking-[0.22em] opacity-70">
                    {style.label}
                  </p>
                  <p className="font-heading text-[15px] leading-tight text-foreground mt-0.5">
                    {item.titulo}
                  </p>
                </div>
                {item.metric && (
                  <span className="font-heading text-2xl tabular-nums leading-none">
                    {item.metric}
                  </span>
                )}
              </div>
              <p className="text-[12px] leading-relaxed text-foreground/70">
                {item.detalle}
              </p>
              {item.accion && (
                <button
                  type="button"
                  onClick={() => onSend(item.accion!.prompt)}
                  className="mt-1 inline-flex items-center gap-1.5 self-start text-[11px] font-semibold tracking-[0.12em] uppercase text-brand hover:gap-2 transition-all"
                >
                  {item.accion.label}
                  <ArrowRight className="size-3" strokeWidth={2} />
                </button>
              )}
            </motion.div>
          );
        })}
      </motion.div>
    </motion.div>
  );
}
