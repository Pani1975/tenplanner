"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

/**
 * Botón del administrador para publicar o retirar de la biblioteca un
 * ejercicio de Ten Planner. Muestra el estado actual y lo cambia al pulsar.
 */
export function ExercisePublishToggle({
  exerciseId,
  initialPublished,
  className,
  compact = false,
}: {
  exerciseId: string;
  initialPublished: boolean;
  className?: string;
  compact?: boolean;
}) {
  const tx = useTranslations("ui.s_app_exercisepublishtoggle");
  const router = useRouter();
  const [published, setPublished] = useState(initialPublished);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !published;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/exercises/${exerciseId}/publish`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ published: next }),
      });
      if (!res.ok) throw new Error();
      setPublished(next);
      router.refresh();
    } catch {
      setError(tx("noSePudoGuardar"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {!compact && (
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
            published
              ? "bg-[#D6FF38] text-[#050505]"
              : "bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-200"
          )}
        >
          {published ? "Publicado" : "Sin publicar"}
        </span>
      )}
      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        aria-pressed={published}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
          published
            ? "border-[#050505]/12 bg-white text-muted-foreground hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]"
            : "border-[#050505] bg-[#050505] text-white hover:bg-[#050505]/85 dark:border-white dark:bg-white dark:text-[#050505]"
        )}
      >
        {saving ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : published ? (
          <EyeOff className="size-3.5" />
        ) : (
          <Eye className="size-3.5" />
        )}
        {published ? tx("retirarDeLaBiblioteca") : "Publicar"}
      </button>
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
