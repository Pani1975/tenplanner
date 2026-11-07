"use client";

import { useState } from "react";
import { Loader2, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  adminPanelClass,
  adminPrimaryActionClass,
} from "../_components/admin-ui";

interface Stats {
  exercises: { total: number; embedded: number };
  sessions: { total: number; embedded: number };
}

function CoverageBar({
  label,
  embedded,
  total,
  color,
}: {
  label: string;
  embedded: number;
  total: number;
  color: string;
}) {
  const pct = total === 0 ? 0 : Math.round((embedded / total) * 100);
  const missing = total - embedded;

  return (
    <div className={cn(adminPanelClass, "p-5 sm:p-6")}>
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <p className="font-sans text-[10px] uppercase tracking-[0.22em] text-foreground/40">
            {label}
          </p>
          <p className="mt-1 font-heading text-3xl font-semibold text-foreground">
            {embedded.toLocaleString("es-ES")}
            <span className="text-foreground/35 text-lg font-normal">
              {" "}
              / {total.toLocaleString("es-ES")}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pct === 100 ? (
            <CheckCircle2 className="size-5 text-emerald-400" />
          ) : (
            <AlertCircle className="size-5 text-amber-400" />
          )}
          <span
            className={cn(
              "font-heading text-2xl font-semibold",
              pct === 100 ? "text-emerald-400" : "text-amber-400"
            )}
          >
            {pct}%
          </span>
        </div>
      </div>
      <div className="h-2 rounded-full bg-foreground/8 overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${Math.max(pct === 0 ? 0 : 4, pct)}%` }}
        />
      </div>
      {missing > 0 && (
        <p className="mt-2 text-xs text-foreground/45">
          {missing.toLocaleString("es-ES")} sin indexar
        </p>
      )}
    </div>
  );
}

export function EmbeddingsClient({ stats: initial }: { stats: Stats }) {
  const [stats, setStats] = useState(initial);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    exercisesProcessed: number;
    sessionsProcessed: number;
    errors: number;
  } | null>(null);

  async function runBackfill() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/embeddings/backfill", {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Error en el backfill");
        return;
      }
      setResult(data);
      // refresh stats
      const statsRes = await fetch("/api/admin/embeddings");
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }
      toast.success(
        `Backfill completado: ${data.exercisesProcessed} ejercicios, ${data.sessionsProcessed} sesiones`
      );
    } catch {
      toast.error("Error de red al ejecutar el backfill");
    } finally {
      setLoading(false);
    }
  }

  const totalMissing =
    stats.exercises.total -
    stats.exercises.embedded +
    (stats.sessions.total - stats.sessions.embedded);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CoverageBar
          label="Ejercicios indexados"
          embedded={stats.exercises.embedded}
          total={stats.exercises.total}
          color="bg-brand"
        />
        <CoverageBar
          label="Sesiones indexadas"
          embedded={stats.sessions.embedded}
          total={stats.sessions.total}
          color="bg-sky-400"
        />
      </div>

      <div className={cn(adminPanelClass, "p-5 sm:p-6")}>
        <h2 className="font-heading text-base font-semibold text-foreground mb-1">
          Backfill de embeddings
        </h2>
        <p className="text-sm text-foreground/55 mb-5">
          Indexa todo el contenido existente que aún no tiene embedding. Los
          ejercicios y sesiones nuevos se indexan automáticamente al crearlos.
          Requiere{" "}
          <code className="font-mono text-[11px] bg-foreground/8 px-1 py-0.5 rounded">
            VOYAGE_API_KEY
          </code>{" "}
          configurada.
        </p>

        {totalMissing === 0 ? (
          <div className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 className="size-4" />
            Todo el contenido está indexado.
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={runBackfill}
              disabled={loading}
              className={cn(
                adminPrimaryActionClass,
                "h-9 px-4 text-[11px] uppercase tracking-[0.18em] disabled:opacity-40"
              )}
            >
              {loading ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <RefreshCw className="size-3.5" />
              )}
              {loading ? "Procesando…" : `Indexar ${totalMissing} pendientes`}
            </button>
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-1 rounded-lg border border-foreground/12 bg-card/80 p-4">
            <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/40 mb-2">
              Resultado
            </p>
            <p className="text-sm text-foreground/80">
              <span className="font-semibold text-brand">
                {result.exercisesProcessed}
              </span>{" "}
              ejercicios procesados
            </p>
            <p className="text-sm text-foreground/80">
              <span className="font-semibold text-sky-400">
                {result.sessionsProcessed}
              </span>{" "}
              sesiones procesadas
            </p>
            {result.errors > 0 && (
              <p className="text-sm text-amber-400">
                {result.errors} errores (ver logs del servidor)
              </p>
            )}
          </div>
        )}
      </div>

      <div className={cn(adminPanelClass, "p-5 sm:p-6")}>
        <h2 className="font-heading text-base font-semibold text-foreground mb-3">
          Cómo funciona
        </h2>
        <div className="space-y-2 text-sm text-foreground/60 leading-relaxed">
          <p>
            Cada ejercicio y sesión se convierte en texto descriptivo y se envía
            a{" "}
            <code className="font-mono text-[11px] bg-foreground/8 px-1 py-0.5 rounded">
              voyage-3.5
            </code>{" "}
            de Voyage AI para obtener un vector de 1024 dimensiones.
          </p>
          <p>
            El vector se almacena en Postgres con la extensión{" "}
            <code className="font-mono text-[11px] bg-foreground/8 px-1 py-0.5 rounded">
              pgvector
            </code>
            . Dr. Planner busca por similitud coseno con umbral ≥ 0.72.
          </p>
          <p>
            Activa la búsqueda semántica en{" "}
            <a href="/admin/settings" className="text-brand hover:underline">
              Ajustes → ai.semantic_search_enabled
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
