"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SPORT_OPTIONS, type Sport } from "@/lib/sport-constants";
import { cn } from "@/lib/utils";
import { useTerm } from "@/lib/i18n-terms";

export function SportChangePill({ sport }: { sport: Sport }) {
  const term = useTerm();
  const router = useRouter();
  const [loading, setLoading] = useState<Sport | null>(null);

  async function choose(next: Sport) {
    if (next === sport || loading) return;
    setLoading(next);
    try {
      const res = await fetch("/api/public/sport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport: next }),
      });
      if (res.ok) router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {SPORT_OPTIONS.map((option) => {
        const isActive = option.id === sport;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => choose(option.id)}
            disabled={loading !== null}
            aria-pressed={isActive}
            className={cn(
              "inline-flex min-h-8 items-center rounded-full border px-3 text-[11px] font-bold tracking-wide transition disabled:opacity-50",
              isActive
                ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
                : "border-white/18 bg-white/[0.04] text-white/70 hover:border-[#D6FF38]/60 hover:text-[#D6FF38]"
            )}
          >
            {term(option.label)}
          </button>
        );
      })}
    </div>
  );
}
