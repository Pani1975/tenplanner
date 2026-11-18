"use client";

import { motion } from "motion/react";
import { Sparkles, Clock, Flame, Target, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

type Recommendation = {
  focus: string;
  durationSugerida: number;
  intensitySugerida: number;
  razonamiento: string;
  insight?: string | null;
  targetStudents: { id: string; name: string }[];
  suggestedTags: string[];
  gaps: { label: string; severity: "alto" | "medio" | "bajo"; kind: string }[];
};

export function RecommendationCard({
  part,
  onSend,
}: {
  part: { state: string; output?: unknown };
  onSend: (text: string) => void;
}) {
  const tx = useTranslations("ui.s_drplanner_recommendationcard");
  if (part.state !== "output-available") {
    return (
      <div className="border border-brand/20 bg-brand/[0.03] p-5 animate-pulse h-32" />
    );
  }

  const data = part.output as {
    ok: boolean;
    recomendacion?: Recommendation;
    error?: string;
  };

  if (!data?.ok || !data.recomendacion) {
    return (
      <div className="border-l-2 border-destructive/50 bg-destructive/[0.05] px-4 py-3 text-[13px] text-destructive">
        {data?.error ?? tx("noSePudoGenerar")}
      </div>
    );
  }

  const r = data.recomendacion;
  const targetNames = r.targetStudents.map((s) => s.name).join(", ");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="border border-brand/40 bg-gradient-to-br from-brand/[0.06] to-transparent"
    >
      <div className="flex items-start gap-3 p-5 border-b border-brand/20">
        <div className="size-9 border border-brand/40 bg-brand/10 flex items-center justify-center shrink-0">
          <Sparkles className="size-4 text-brand" strokeWidth={1.6} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-sans text-[10px] uppercase tracking-[0.28em] text-brand">
            {tx("propuestaDeSesion")}
          </p>
          <h3 className="font-heading text-xl leading-tight mt-0.5">
            {r.focus}
          </h3>
          <p className="text-[12px] text-foreground/60 mt-1">
            {tx("para")}{" "}<span className="text-foreground">{targetNames}</span>
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 border-b border-brand/20">
        <SpecKPI
          icon={Clock}
          label={tx("duracion")}
          value={`${r.durationSugerida}′`}
        />
        <SpecKPI
          icon={Flame}
          label={tx("intensidad")}
          value={`${r.intensitySugerida}/5`}
          bordered
        />
        <SpecKPI icon={Target} label={tx("gaps")} value={String(r.gaps.length)} />
      </div>

      <div className="px-5 py-4 space-y-3">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/55 mb-1">
            {tx("razonamiento")}
          </p>
          <p className="text-[13px] leading-relaxed text-foreground">
            {r.razonamiento}
          </p>
        </div>

        {r.insight && (
          <div className="border-l-2 border-brand/50 bg-brand/[0.04] px-3 py-2">
            <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-brand mb-0.5">
              {tx("lecturaDeIa")}
            </p>
            <p className="text-[12px] leading-relaxed italic">{r.insight}</p>
          </div>
        )}

        {r.gaps.length > 0 && (
          <div>
            <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/55 mb-1.5">
              {tx("huecosACubrir")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {r.gaps.map((g, i) => (
                <span
                  key={i}
                  className={cn(
                    "text-[11px] border px-2 py-0.5 inline-flex items-center gap-1.5",
                    g.severity === "alto" &&
                      "border-destructive/40 text-destructive",
                    g.severity === "medio" &&
                      "border-amber-500/40 text-amber-600",
                    g.severity === "bajo" &&
                      "border-foreground/20 text-foreground/60"
                  )}
                >
                  {g.label}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 p-4 bg-foreground/[0.02] border-t border-brand/20">
        <button
          type="button"
          onClick={() =>
            onSend(
              `Diseña esta sesión: ${r.focus}. Duración ${r.durationSugerida} min, intensidad ${r.intensitySugerida}/5, para ${targetNames}.`
            )
          }
          className="inline-flex items-center gap-2 border border-brand bg-brand text-brand-foreground text-[11px] font-semibold tracking-[0.18em] uppercase px-4 py-2 hover:bg-brand/90 transition-colors"
        >
          {tx("disenarEstaSesion")}
          <ArrowRight className="size-3" strokeWidth={2} />
        </button>
        <button
          type="button"
          onClick={() =>
            onSend(`Afina la propuesta: cambia el foco o la duración.`)
          }
          className="inline-flex items-center gap-2 border border-foreground/20 text-[11px] font-semibold tracking-[0.18em] uppercase px-3 py-2 hover:border-foreground/40 transition-colors"
        >
          {tx("afinar")}
        </button>
      </div>
    </motion.div>
  );
}

function SpecKPI({
  icon: Icon,
  label,
  value,
  bordered,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  bordered?: boolean;
}) {
  return (
    <div className={cn("p-4", bordered && "border-l border-r border-brand/20")}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className="size-3 text-brand" strokeWidth={1.6} />
        <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/55">
          {label}
        </p>
      </div>
      <p className="font-heading text-2xl tabular-nums leading-none text-foreground">
        {value}
      </p>
    </div>
  );
}
