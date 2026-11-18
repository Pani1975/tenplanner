"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  clearTarget,
  parseTarget,
  rawTarget,
  TARGET_EVENT,
  targetToParams,
  type SessionTarget,
} from "@/lib/session-target";
import { useTranslations } from "next-intl";

/** Destino pendiente de la sesión que se está preparando (o null). */
function subscribe(onChange: () => void) {
  window.addEventListener(TARGET_EVENT, onChange);
  return () => window.removeEventListener(TARGET_EVENT, onChange);
}

function usePendingTarget(): SessionTarget | null {
  const raw = useSyncExternalStore(subscribe, rawTarget, () => null);
  return useMemo(() => parseTarget(raw), [raw]);
}

/**
 * Aviso «Preparando una sesión para X · día» con el que se mira el catálogo
 * o las sesiones pasadas cuando ya se eligió para quién y cuándo.
 */
export function PendingTargetBanner({ className }: { className?: string }) {
  const tx = useTranslations("ui.s_app_pendingsessiontarget");
  const target = usePendingTarget();
  if (!target) return null;
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#D6FF38]/60 bg-[#D6FF38]/15 px-4 py-3",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground/60">
          {tx("preparandoUnaSesion")}
        </p>
        <p className="text-sm font-semibold text-foreground">
          {target.label ?? tx("sesionSinDestino")}
        </p>
      </div>
      <button
        type="button"
        onClick={() => clearTarget()}
        className="inline-flex items-center gap-1.5 rounded-full border border-foreground/20 bg-background px-3 py-1.5 text-xs font-bold text-foreground hover:bg-muted"
      >
        <X className="size-3.5" />
        {tx("cancelar")}
      </button>
    </div>
  );
}

interface AddToPendingSessionButtonProps {
  /** Una clase de la biblioteca o del club… */
  classId?: string;
  /** …o una sesión pasada que se reutiliza. */
  sessionId?: string;
  className?: string;
  compact?: boolean;
}

/**
 * «Añadir la clase a la sesión» (o «Reutilizar en la sesión»): abre el
 * asistente con la clase o sesión elegida y el destino ya puesto (para
 * quién, día y hora, pistas), así que el nombre sale solo. Solo aparece si
 * hay una sesión en preparación.
 */
export function AddToPendingSessionButton({
  classId,
  sessionId,
  className,
  compact = false,
}: AddToPendingSessionButtonProps) {
  const tx = useTranslations("ui.s_app_pendingsessiontarget");
  const router = useRouter();
  const target = usePendingTarget();
  if (!target) return null;

  function go() {
    if (!target) return;
    const qs = targetToParams(target);
    qs.set("target", "1");
    if (classId) qs.set("fromClass", classId);
    if (sessionId) qs.set("from", sessionId);
    router.push(`/sessions/new?${qs.toString()}`);
  }

  const label = classId ? tx("anadirLaClaseA") : tx("reutilizarEnLaSesion");
  return (
    <button
      type="button"
      onClick={go}
      title={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-[#D6FF38] px-3.5 py-2 text-xs font-bold text-[#050505] shadow-sm transition-colors hover:bg-[#c8ef2f]",
        className
      )}
    >
      <PlusCircle className="size-4" />
      {compact ? tx("anadirALaSesion") : label}
    </button>
  );
}
