"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  Check,
  Globe2,
  Loader2,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClubOption } from "@/components/app/club-context-select";
import { goAfterModeChange } from "@/lib/work-mode-navigation";
import {
  activeWorkModeKey,
  workModeOptions,
  workModeRequestBody,
  type WorkModeKind,
} from "@/lib/work-mode-options";

const MODE_ICONS: Record<WorkModeKind, React.ElementType> = {
  admin: Globe2,
  management: BarChart3,
  club: Building2,
  particular: User,
};

/**
 * Selector siempre visible (barra lateral / cabecera móvil) de en qué "modo
 * de trabajo" se está ahora mismo: un botón por modo, con el activo
 * resaltado, para cambiar sin tener que ir a Perfil. Qué modos hay depende
 * del tipo de cuenta (ver lib/work-mode-options.ts). Solo se renderiza si
 * hay algo que elegir.
 *
 * El estado inicial sale de las props: quien lo usa le pone `key` con el
 * modo del servidor, para que se rehaga si el modo cambia desde otro sitio
 * (p. ej. desde Perfil).
 */
export function WorkModeBadge({
  clubs,
  activeClubId,
  canUseTenPlanner = false,
  tenPlannerActive = false,
  clubAccountClubId = null,
  managementActive = false,
  className,
}: {
  clubs: ClubOption[];
  activeClubId: string | null;
  canUseTenPlanner?: boolean;
  tenPlannerActive?: boolean;
  /** Cuenta de un club: su club (Modo <club> + Modo gestión). */
  clubAccountClubId?: string | null;
  managementActive?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const options = workModeOptions({
    clubs,
    isAdmin: canUseTenPlanner,
    clubAccountClubId,
  });
  const [activeKey, setActiveKey] = useState<string>(() =>
    activeWorkModeKey({
      tenPlannerMode: canUseTenPlanner && tenPlannerActive,
      managementMode: !!clubAccountClubId && managementActive,
      activeClubId,
    })
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (options.length < 2) return null;

  async function selectMode(key: string) {
    if (key === activeKey || saving !== null) return;
    setSaving(key);
    setError(null);
    const res = await fetch("/api/account/work-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(workModeRequestBody(key)),
    });
    if (res.ok) {
      const previous = activeKey;
      setActiveKey(key);
      goAfterModeChange(router, previous, key);
    } else {
      setError("No se pudo cambiar. Inténtalo de nuevo.");
    }
    setSaving(null);
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="px-0.5 font-mono text-[9px] uppercase tracking-[0.14em] text-sidebar-foreground/55">
        Modo de trabajo
      </p>
      <div role="group" aria-label="Modo de trabajo" className="grid gap-1">
        {options.map((option) => {
          const Icon = MODE_ICONS[option.kind];
          const active = option.key === activeKey;
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => selectMode(option.key)}
              disabled={saving !== null}
              aria-pressed={active}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] font-bold transition-colors disabled:opacity-60",
                active
                  ? "border-brand/50 bg-brand/10 text-foreground"
                  : "border-sidebar-border bg-sidebar-accent/40 text-sidebar-foreground/75 hover:bg-sidebar-accent"
              )}
            >
              {saving === option.key ? (
                <Loader2 className="size-3.5 shrink-0 animate-spin" />
              ) : (
                <Icon
                  className={cn("size-3.5 shrink-0", active && "text-brand")}
                  strokeWidth={2}
                />
              )}
              <span className="min-w-0 flex-1 truncate">
                {capitalize(option.name)}
              </span>
              {active && saving === null && (
                <Check className="size-3.5 shrink-0 text-brand" />
              )}
            </button>
          );
        })}
      </div>
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
