"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface DraftStatusPillProps {
  status: "idle" | "saving" | "saved";
  savedAt: Date | null;
  className?: string;
}

function formatRelative(date: Date): string {
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 10) return "ahora mismo";
  if (seconds < 60) return `hace ${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes}min`;
  return `hace ${Math.round(minutes / 60)}h`;
}

export function DraftStatusPill({
  status,
  savedAt,
  className,
}: DraftStatusPillProps) {
  const tx = useTranslations("ui.s_app_draftstatuspill");
  const [, tick] = useState(0);

  // Re-render every 30s to update the relative timestamp
  useEffect(() => {
    if (status !== "saved" || !savedAt) return;
    const interval = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(interval);
  }, [status, savedAt]);

  if (status === "idle") return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium tabular-nums transition-all",
        status === "saving"
          ? "bg-muted text-muted-foreground"
          : "bg-brand/8 text-brand",
        className
      )}
    >
      {status === "saving" ? (
        <>
          <Loader2 className="size-3 animate-spin" />
          {tx("guardando")}
        </>
      ) : (
        <>
          <Check className="size-3" strokeWidth={2.5} />
          {tx("guardadoAutomatico")}{" "}{savedAt ? `· ${formatRelative(savedAt)}` : ""}
        </>
      )}
    </span>
  );
}
