import { Hash } from "lucide-react";
import { cn } from "@/lib/utils";

// Objetivo, material, observaciones y etiquetas de una sesión. Se usa igual en
// la ficha (pendiente, completada o cancelada) y en las tarjetas de borrador.

interface SessionInfoSummaryProps {
  objective?: string | null;
  material?: string | null;
  observations?: string | null;
  tags?: string[] | null;
  /** Versión reducida (tarjetas de borrador): textos recortados. */
  compact?: boolean;
  className?: string;
}

export function hasSessionInfo({
  objective,
  material,
  observations,
  tags,
}: Pick<
  SessionInfoSummaryProps,
  "objective" | "material" | "observations" | "tags"
>) {
  return (
    !!objective?.trim() ||
    !!material?.trim() ||
    !!observations?.trim() ||
    (tags?.length ?? 0) > 0
  );
}

export function SessionInfoSummary({
  objective,
  material,
  observations,
  tags,
  compact = false,
  className,
}: SessionInfoSummaryProps) {
  if (!hasSessionInfo({ objective, material, observations, tags })) {
    return null;
  }

  const fields = [
    { label: "Objetivo", value: objective },
    { label: "Material", value: material },
    { label: "Observaciones", value: observations },
  ].filter((f) => f.value?.trim());

  return (
    <div className={cn(compact ? "space-y-1.5" : "space-y-4", className)}>
      {fields.length > 0 && (
        <div
          className={cn(
            "grid",
            compact ? "gap-1.5" : "gap-4 sm:grid-cols-2"
          )}
        >
          {fields.map((f) => (
            <div
              key={f.label}
              className={cn(!compact && f.label === "Objetivo" && "sm:col-span-2")}
            >
              <p
                className={cn(
                  "font-bold uppercase tracking-widest text-muted-foreground",
                  compact ? "text-[9px]" : "mb-2 text-[10px]"
                )}
              >
                {f.label}
              </p>
              <p
                className={cn(
                  "leading-relaxed text-foreground",
                  compact
                    ? "line-clamp-2 text-[12px] text-foreground/70"
                    : "whitespace-pre-wrap text-sm"
                )}
              >
                {f.value}
              </p>
            </div>
          ))}
        </div>
      )}

      {tags && tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <span
              key={tag}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand/10 text-brand",
                compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
              )}
            >
              <Hash className="size-3" />
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
