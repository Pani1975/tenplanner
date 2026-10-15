"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export type CopyTarget = "active" | "particular";

/**
 * Copia un ejercicio o una clase a "Mis ejercicios" / "Mis clases":
 *
 * - target "active": desde la Biblioteca al espacio en el que se trabaja
 *   ahora (particular o club, según el modo de trabajo).
 * - target "particular": una ficha que el propio monitor creó en el
 *   espacio de un club, a su espacio particular (solo él la verá).
 *
 * La copia es independiente y editable; al terminar se abre la copia.
 */
export function CopyToSpaceButton({
  kind,
  id,
  targets,
  tone = "light",
  className,
}: {
  kind: "exercise" | "class";
  id: string;
  targets: CopyTarget[];
  tone?: "light" | "dark";
  className?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<CopyTarget | null>(null);

  if (targets.length === 0) return null;

  async function copy(target: CopyTarget) {
    setBusy(target);
    try {
      const base = kind === "exercise" ? "/api/exercises" : "/api/classes";
      const res = await fetch(`${base}/${id}/copy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { id: string };
        error?: string;
      };
      if (!res.ok || !json.data?.id) {
        toast.error(json.error ?? "No se pudo copiar. Inténtalo de nuevo.");
        return;
      }
      const what = kind === "exercise" ? "Ejercicio copiado" : "Clase copiada";
      const where =
        target === "particular"
          ? "a tu espacio particular"
          : kind === "exercise"
            ? "a Mis ejercicios"
            : "a Mis clases";
      toast.success(`${what} ${where}`);
      if (target === "active") {
        router.push(
          kind === "exercise"
            ? `/exercises/${json.data.id}`
            : `/classes/${json.data.id}`
        );
      }
    } finally {
      setBusy(null);
    }
  }

  const base =
    tone === "dark"
      ? "border-white/16 text-white/70 hover:border-[#D6FF38] hover:text-[#D6FF38]"
      : "border-[#050505]/12 bg-white text-muted-foreground hover:border-[#D6FF38] hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]";

  return (
    <>
      {targets.map((target) => (
        <button
          key={target}
          type="button"
          onClick={() => copy(target)}
          disabled={busy !== null}
          className={cn(
            "inline-flex items-center justify-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
            base,
            className
          )}
        >
          {busy === target ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {target === "particular"
            ? "Copiar a mi espacio particular"
            : kind === "exercise"
              ? "Copiar a Mis ejercicios"
              : "Copiar a Mis clases"}
        </button>
      ))}
    </>
  );
}
