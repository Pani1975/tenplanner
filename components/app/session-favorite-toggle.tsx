"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { SessionListPicker } from "./session-list-picker";
import { useTranslations } from "next-intl";

/** Corazón para guardar una sesión en una lista de favoritas. */
export function SessionFavoriteToggle({
  sessionId,
  sessionTitle,
  initialFavorited,
  variant = "icon",
  className,
}: {
  sessionId: string;
  sessionTitle?: string;
  initialFavorited: boolean;
  /** "icon": círculo pequeño (tarjetas). "pill": botón con texto (cabecera). */
  variant?: "icon" | "pill";
  className?: string;
}) {
  const tx = useTranslations("ui.s_app_sessionfavoritetoggle");
  const [favorited, setFavorited] = useState(initialFavorited);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        aria-label={favorited ? "Gestionar listas" : tx("anadirAFavoritas")}
        title={favorited ? "En favoritas" : tx("anadirAFavoritas")}
        className={cn(
          variant === "icon"
            ? "flex size-8 items-center justify-center rounded-full transition-colors"
            : "inline-flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-semibold transition-colors",
          favorited
            ? variant === "icon"
              ? "bg-red-400/10 text-red-400 hover:bg-red-400/20"
              : "border-red-400/40 bg-red-400/10 text-red-400 hover:bg-red-400/20"
            : variant === "icon"
              ? "bg-foreground/5 text-foreground/35 hover:bg-red-400/10 hover:text-red-400"
              : "border-border bg-white/70 text-muted-foreground hover:border-red-400/40 hover:text-red-400 dark:bg-white/[0.035]",
          className
        )}
      >
        <Heart
          className={cn(
            variant === "icon" ? "size-4" : "size-3.5",
            favorited && "fill-current"
          )}
        />
        {variant === "pill" && (
          <span className="hidden sm:inline">{tx("favorita")}</span>
        )}
      </button>
      {open && (
        <SessionListPicker
          sessionId={sessionId}
          sessionTitle={sessionTitle}
          onClose={() => setOpen(false)}
          onFavoritedChange={setFavorited}
        />
      )}
    </>
  );
}
