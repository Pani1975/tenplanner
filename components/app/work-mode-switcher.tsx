"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ClubOption } from "@/components/app/club-context-select";

const PARTICULAR = "particular";

export function WorkModeSwitcher({
  clubs,
  activeClubId: initialActiveClubId,
}: {
  clubs: ClubOption[];
  activeClubId: string | null;
}) {
  const router = useRouter();
  const [activeClubId, setActiveClubId] = useState<string | null>(
    initialActiveClubId
  );
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (clubs.length === 0) return null;

  async function selectMode(clubId: string | null) {
    if (clubId === activeClubId) return;
    setSaving(clubId ?? PARTICULAR);
    setError(null);
    const res = await fetch("/api/account/work-mode", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clubId }),
    });
    if (res.ok) {
      setActiveClubId(clubId);
      router.refresh();
    } else {
      setError("No se pudo cambiar el modo de trabajo. Inténtalo de nuevo.");
    }
    setSaving(null);
  }

  const activeClub = clubs.find((c) => c.id === activeClubId);

  return (
    <div className="tp-panel space-y-3 p-5 sm:p-6">
      <div>
        <h2 className="text-sm font-black uppercase text-foreground">
          Modo de trabajo
        </h2>
        <p className="mt-1 text-xs text-foreground/55 leading-relaxed">
          Decide si lo que crees a partir de ahora (sesiones, alumnos, clases,
          grupos, eventos) es tuyo en particular o del club — se comparte con el
          resto de monitores del club mientras estés en ese modo. Puedes
          cambiarlo cuando quieras; lo ya creado no cambia de dueño.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => selectMode(null)}
          disabled={saving !== null}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
            activeClubId === null
              ? "border-brand bg-brand/10 text-foreground"
              : "border-border text-muted-foreground hover:bg-muted"
          )}
        >
          {saving === PARTICULAR ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <User className="size-4" />
          )}
          Particular
        </button>
        {clubs.map((club) => (
          <button
            key={club.id}
            type="button"
            onClick={() => selectMode(club.id)}
            disabled={saving !== null}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
              activeClubId === club.id
                ? "border-brand bg-brand/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {saving === club.id ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Building2 className="size-4" />
            )}
            {club.name}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      {activeClub && (
        <p className="text-xs text-foreground/50">
          Ahora mismo trabajas como <strong>{activeClub.name}</strong>: lo que
          crees es visible para el resto de monitores de ese club.
        </p>
      )}
    </div>
  );
}
