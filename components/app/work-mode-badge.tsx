"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, ChevronDown, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClubOption } from "@/components/app/club-context-select";

const PARTICULAR = "particular";

/**
 * Indicador siempre visible (barra lateral / cabecera móvil) de en qué
 * "modo de trabajo" está el monitor ahora mismo — particular o un club —
 * con un desplegable para cambiarlo sin tener que ir a Perfil. Solo se
 * renderiza si el usuario pertenece a al menos un club (si no, no hay
 * nada que elegir y todo es particular).
 */
export function WorkModeBadge({
  clubs,
  activeClubId: initialActiveClubId,
  className,
}: {
  clubs: ClubOption[];
  activeClubId: string | null;
  className?: string;
}) {
  const router = useRouter();
  const [activeClubId, setActiveClubId] = useState<string | null>(
    initialActiveClubId
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

  if (clubs.length === 0) return null;

  const activeClub = clubs.find((c) => c.id === activeClubId);

  async function selectMode(clubId: string | null) {
    if (clubId === activeClubId) {
      setOpen(false);
      return;
    }
    setSaving(clubId ?? PARTICULAR);
    setError(null);
    const res = await fetch("/api/account/work-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId }),
    });
    if (res.ok) {
      setActiveClubId(clubId);
      setOpen(false);
      router.refresh();
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
          activeClub
            ? "border-brand/50 bg-brand/10 text-foreground"
            : "border-sidebar-border bg-sidebar-accent/60 text-sidebar-foreground/75 hover:bg-sidebar-accent"
        )}
      >
        {activeClub ? (
          <Building2 className="size-3.5 shrink-0 text-brand" strokeWidth={2} />
        ) : (
          <User className="size-3.5 shrink-0" strokeWidth={2} />
        )}
        <span className="min-w-0 flex-1 truncate">
          <span className="mr-1 font-mono text-[9px] uppercase tracking-[0.14em] opacity-55">
            Modo
          </span>
          {activeClub ? activeClub.name : "Particular"}
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
          <OptionRow
            label="Particular"
            icon={User}
            active={activeClubId === null}
            saving={saving === PARTICULAR}
            disabled={saving !== null}
            onClick={() => selectMode(null)}
          />
          {clubs.map((club) => (
            <OptionRow
              key={club.id}
              label={club.name}
              icon={Building2}
              active={activeClubId === club.id}
              saving={saving === club.id}
              disabled={saving !== null}
              onClick={() => selectMode(club.id)}
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
