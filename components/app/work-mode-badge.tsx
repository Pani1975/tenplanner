"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Building2,
  Check,
  ChevronDown,
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
 * Indicador siempre visible (barra lateral / cabecera móvil) de en qué
 * "modo de trabajo" se está ahora mismo, con un desplegable para cambiarlo
 * sin tener que ir a Perfil. Qué modos hay depende del tipo de cuenta (ver
 * lib/work-mode-options.ts). Solo se renderiza si hay algo que elegir.
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
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  if (options.length < 2) return null;

  const active = options.find((o) => o.key === activeKey) ?? options[0];
  const ActiveIcon = MODE_ICONS[active.kind];

  async function selectMode(key: string) {
    if (key === activeKey) {
      setOpen(false);
      return;
    }
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
      setOpen(false);
      goAfterModeChange(router, previous, key);
    } else {
      setError("No se pudo cambiar. Inténtalo de nuevo.");
    }
    setSaving(null);
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-[12px] font-bold transition-colors",
          active.kind !== "particular"
            ? "border-brand/50 bg-brand/10 text-foreground"
            : "border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground/75 hover:bg-sidebar-accent"
        )}
      >
        <ActiveIcon
          className={cn(
            "size-3.5 shrink-0",
            active.kind !== "particular" && "text-brand"
          )}
          strokeWidth={2}
        />
        <span className="min-w-0 flex-1 truncate">
          <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.14em] opacity-55">
            Modo
          </span>
          {capitalize(active.name)}
        </span>
        <ChevronDown
          className={cn(
            "size-3.5 shrink-0 opacity-55 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-lg border border-sidebar-border bg-sidebar shadow-[0_18px_50px_rgba(0,0,0,0.35)]">
          {options.map((option) => (
            <OptionRow
              key={option.key}
              label={`Modo ${option.name}`}
              icon={MODE_ICONS[option.kind]}
              active={option.key === activeKey}
              saving={saving === option.key}
              disabled={saving !== null}
              onClick={() => selectMode(option.key)}
            />
          ))}
          {error && (
            <p className="border-t border-sidebar-border px-3 py-2 text-[11px] text-destructive">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function OptionRow({
  label,
  icon: Icon,
  active,
  saving,
  disabled,
  onClick,
}: {
  label: string;
  icon: React.ElementType;
  active: boolean;
  saving: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-2 px-3 py-2.5 text-left text-[12px] font-semibold transition-colors disabled:opacity-60",
        active
          ? "bg-brand/10 text-foreground"
          : "text-sidebar-foreground/75 hover:bg-sidebar-accent"
      )}
    >
      {saving ? (
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
      ) : (
        <Icon className="size-3.5 shrink-0" />
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {active && !saving && <Check className="size-3.5 shrink-0 text-brand" />}
    </button>
  );
}
