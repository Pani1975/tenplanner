"use client";

import { useState, useSyncExternalStore } from "react";
import { Eye, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { id: "club", label: "Club", home: "/dashboard" },
  { id: "monitor", label: "Monitor", home: "/dashboard" },
  { id: "jugador", label: "Jugador", home: "/jugador" },
] as const;

type Mode = (typeof OPTIONS)[number]["id"];

function currentMode(): Mode {
  const m = document.cookie.match(/(?:^|; )tp_view_as=([^;]+)/);
  return m?.[1] === "monitor" || m?.[1] === "jugador" ? m[1] : "club";
}

/** «Ver como» del administrador (lib/view-as.ts). */
export function ViewAsSwitcher() {
  // La cookie solo cambia al elegir (y entonces se recarga la página).
  const mode = useSyncExternalStore(
    () => () => {},
    currentMode,
    () => "club" as Mode
  );
  const [busy, setBusy] = useState<Mode | null>(null);
  const [error, setError] = useState(false);


  async function choose(next: Mode) {
    if (next === mode || busy) return;
    setBusy(next);
    setError(false);
    const res = await fetch("/api/account/view-as", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: next }),
    }).catch(() => null);
    if (!res?.ok) {
      setBusy(null);
      setError(true);
      return;
    }
    window.location.assign(OPTIONS.find((o) => o.id === next)!.home);
  }

  return (
    <div className="mt-2 space-y-1.5">
      <p className="flex items-center gap-1.5 px-1 text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/45">
        <Eye className="size-3" />
        Ver como
      </p>
      <div className="grid grid-cols-3 gap-1 rounded-lg bg-sidebar-accent p-1" role="group" aria-label="Ver como">
        {OPTIONS.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={mode === o.id}
            onClick={() => choose(o.id)}
            className={cn(
              "flex min-h-8 items-center justify-center rounded-md text-[11px] font-bold transition-colors",
              mode === o.id
                ? "bg-brand text-brand-foreground"
                : "text-sidebar-foreground/65 hover:text-sidebar-foreground"
            )}
          >
            {busy === o.id ? <Loader2 className="size-3 animate-spin" /> : o.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="px-1 text-[11px] text-destructive">No se ha podido cambiar.</p>
      )}
    </div>
  );
}
