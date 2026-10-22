"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Building2, Globe2, Loader2, User } from "lucide-react";
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

export function WorkModeSwitcher({
  clubs,
  activeClubId,
  canUseTenPlanner = false,
  tenPlannerActive = false,
  clubAccountClubId = null,
  managementActive = false,
}: {
  clubs: ClubOption[];
  activeClubId: string | null;
  canUseTenPlanner?: boolean;
  tenPlannerActive?: boolean;
  clubAccountClubId?: string | null;
  managementActive?: boolean;
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
    if (key === activeKey) return;
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
      setError("No se pudo cambiar el modo de trabajo. Inténtalo de nuevo.");
    }
    setSaving(null);
  }

  const active = options.find((o) => o.key === activeKey);

  return (
    <div className="tp-panel space-y-3 p-5 sm:p-6">
      <div>
        <h2 className="text-sm font-black uppercase text-foreground">
          Modo de trabajo
        </h2>
        <p className="mt-1 text-xs text-foreground/55 leading-relaxed">
          {clubAccountClubId
            ? "En el modo del club trabajas con tus monitores: lo que crees lo ven todos. El Modo gestión es solo tuyo: informes, estadísticas y monitores del club."
            : "Decide si lo que crees a partir de ahora (sesiones, alumnos, clases, grupos, eventos) es tuyo en particular o del club — se comparte con el resto de monitores del club mientras estés en ese modo. Puedes cambiarlo cuando quieras; lo ya creado no cambia de dueño."}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const Icon = MODE_ICONS[option.kind];
          return (
            <button
              key={option.key}
              type="button"
              onClick={() => selectMode(option.key)}
              disabled={saving !== null}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
                option.key === activeKey
                  ? "border-brand bg-brand/10 text-foreground"
                  : "border-border text-muted-foreground hover:bg-muted"
              )}
            >
              {saving === option.key ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Icon className="size-4" />
              )}
              Modo {option.name}
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {active?.kind === "admin" && (
        <p className="text-xs text-foreground/50">
          Estás en <strong>Modo administrador</strong>: los ejercicios y clases
          que crees van a la Biblioteca pública, y los cambios en Objetivos
          cambian el catálogo que ven todos los clubes y monitores.
        </p>
      )}
      {active?.kind === "management" && (
        <p className="text-xs text-foreground/50">
          Estás en <strong>Modo gestión</strong>: solo consulta. Para crear
          ejercicios, clases o sesiones del club, cambia al modo del club.
        </p>
      )}
      {active?.kind === "club" && (
        <p className="text-xs text-foreground/50">
          Ahora mismo trabajas en <strong>Modo {active.name}</strong>: lo que
          crees es visible para el resto de monitores de ese club.
        </p>
      )}
    </div>
  );
}
