"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface ExerciseRatingProps {
  exerciseId: string;
  initialRating: number | null; // user's own rating
  avgRating: number;
  totalRatings: number;
  readonly?: boolean;
}

export function ExerciseRating({
  exerciseId,
  initialRating,
  avgRating: initialAvg,
  totalRatings: initialTotal,
  readonly = false,
}: ExerciseRatingProps) {
  const tx = useTranslations("ui.s_app_exerciserating");
  const [userRating, setUserRating] = useState<number | null>(initialRating);
  const [hovered, setHovered] = useState<number | null>(null);
  const [avg, setAvg] = useState(initialAvg);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);

  async function rate(stars: number) {
    if (readonly || loading) return;
    setLoading(true);
    try {
      if (userRating === stars) {
        // toggle off
        const res = await fetch(`/api/exercises/${exerciseId}/rating`, {
          method: "DELETE",
        });
        if (res.ok) {
          const data = await res.json();
          setUserRating(null);
          setAvg(data.avg);
          setTotal(data.total);
        }
      } else {
        const res = await fetch(`/api/exercises/${exerciseId}/rating`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rating: stars }),
        });
        if (res.ok) {
          const data = await res.json();
          setUserRating(stars);
          setAvg(data.avg);
          setTotal(data.total);
        }
      }
    } finally {
      setLoading(false);
    }
  }

  const displayStars = hovered ?? userRating ?? 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            disabled={readonly || loading}
            onClick={() => rate(n)}
            onMouseEnter={() => !readonly && setHovered(n)}
            onMouseLeave={() => !readonly && setHovered(null)}
            className={cn(
              "transition-transform",
              !readonly && !loading && "hover:scale-110 cursor-pointer",
              (readonly || loading) && "cursor-default"
            )}
            aria-label={`Valorar ${n} estrella${n > 1 ? "s" : ""}`}
          >
            <Star
              className={cn(
                "size-5 transition-colors",
                n <= displayStars
                  ? "fill-amber-400 text-amber-400"
                  : "text-foreground/20"
              )}
              strokeWidth={1.4}
            />
          </button>
        ))}
      </div>
      <div className="flex items-baseline gap-1.5">
        {total > 0 ? (
          <>
            <span className="font-heading text-sm font-semibold text-foreground tabular-nums">
              {avg.toFixed(1)}
            </span>
            <span className="font-sans text-[11px] text-foreground/45 tabular-nums">
              {tx("v1ValoracionV2", { v1: total, v2: total !== 1 ? "es" : "" })}</span>
          </>
        ) : (
          <span className="font-sans text-[11px] text-foreground/40 italic">
            {tx("sinValoracionesAun")}
          </span>
        )}
        {userRating && !readonly && (
          <span className="font-sans text-[10px] text-brand ml-1">
            {tx("tuNotaV1", { v1: userRating })}</span>
        )}
      </div>
    </div>
  );
}

// Compact read-only version for cards
export function ExerciseRatingBadge({
  avg,
  total,
}: {
  avg: number;
  total: number;
}) {
  if (total === 0) return null;
  return (
    <span className="inline-flex items-center gap-1 font-sans text-[10px] tabular-nums text-amber-400">
      <Star className="size-3 fill-amber-400" strokeWidth={0} />
      {avg.toFixed(1)}
      <span className="text-foreground/35">({total})</span>
    </span>
  );
}
