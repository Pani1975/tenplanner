"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Check,
  Clock,
  Dumbbell,
  Loader2,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { SessionFavoriteToggle } from "@/components/app/session-favorite-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";

export interface SessionListItem {
  id: string;
  title: string;
  status: "scheduled" | "completed" | "cancelled";
  dayMonth: string;
  weekdayTime: string;
  statusLabel: string;
  statusColor: string;
  relative: string | null;
  durationMinutes: number;
  exerciseCount: number;
  favorited: boolean;
  /** Nombre del monitor que la creó, solo cuando no es la sesión del
   * usuario actual (compartida vía club). */
  authorName?: string | null;
}

/**
 * Lista de sesiones con modo "Seleccionar" para eliminar varias a la vez.
 * `allIds` son todas las sesiones del filtro actual (no solo las de la página).
 */
export function SessionsBulkList({
  items,
  allIds,
  totalFiltered,
  navQuery = "",
}: {
  items: SessionListItem[];
  allIds: string[];
  totalFiltered: number;
  /** Querystring (filter/search) carried into each session's detail link for Next/Previous navigation. */
  navQuery?: string;
}) {
  const router = useRouter();
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recovering, setRecovering] = useState<string | null>(null);

  const pageIds = items.map((i) => i.id);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function stopSelecting() {
    setSelecting(false);
    setSelected(new Set());
    setError(null);
  }

  async function deleteSelected() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/sessions/bulk", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        setError("No se pudieron eliminar. Inténtalo de nuevo.");
        return;
      }
      stopSelecting();
      router.refresh();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setDeleting(false);
    }
  }

  async function recoverSession(id: string) {
    setRecovering(id);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "scheduled" }),
      });
      if (!res.ok) {
        setError("No se pudo recuperar la sesión. Inténtalo de nuevo.");
        return;
      }
      router.refresh();
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setRecovering(null);
    }
  }

  const allSelected = allIds.length > 0 && selected.size === allIds.length;
  const count = selected.size;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {selecting ? (
          <>
            <div className="flex flex-wrap items-center gap-2 text-[13px]">
              <button
                type="button"
                onClick={() => setSelected(new Set(pageIds))}
                className="rounded-full border border-border px-3 py-1.5 font-semibold text-foreground/70 hover:border-[#D6FF38]/70 hover:text-foreground"
              >
                Esta página ({pageIds.length})
              </button>
              {totalFiltered > pageIds.length && (
                <button
                  type="button"
                  onClick={() => setSelected(new Set(allIds))}
                  className={cn(
                    "rounded-full border px-3 py-1.5 font-semibold hover:border-[#D6FF38]/70 hover:text-foreground",
                    allSelected
                      ? "border-[#D6FF38] bg-[#D6FF38]/20 text-foreground"
                      : "border-border text-foreground/70"
                  )}
                >
                  Todas las de este filtro ({allIds.length}
                  {totalFiltered > allIds.length ? "+" : ""})
                </button>
              )}
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="rounded-full px-3 py-1.5 font-semibold text-muted-foreground hover:text-foreground"
              >
                Ninguna
              </button>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={stopSelecting}
                className="rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted-foreground hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={count === 0 || deleting}
                onClick={() => setConfirmOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full bg-destructive px-4 py-2 text-[13px] font-bold text-destructive-foreground transition-colors hover:bg-destructive/90 disabled:opacity-40"
              >
                {deleting ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Eliminar{count > 0 ? ` (${count})` : ""}
              </button>
            </div>
          </>
        ) : (
          <>
            <span />
            <button
              type="button"
              onClick={() => setSelecting(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-1.5 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-[#D6FF38]/70 hover:text-foreground dark:bg-white/[0.035]"
            >
              <Check className="size-3.5" />
              Seleccionar
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <ul className="grid gap-2">
        {items.map((session) => {
          const isSelected = selected.has(session.id);
          const body = (
            <>
              <div className="flex w-20 shrink-0 flex-col items-start border-r border-border pr-3">
                <p className="font-heading text-xl leading-none tabular-nums text-foreground">
                  {session.dayMonth}
                </p>
                <p className="mt-1 text-[11px] uppercase tabular-nums text-foreground/50">
                  {session.weekdayTime}
                </p>
              </div>

              <div className="min-w-0 flex-1 pr-10">
                <div className="mb-1 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center rounded border px-1.5 py-0.5 text-[10.5px] font-medium ${session.statusColor}`}
                  >
                    {session.statusLabel}
                  </span>
                  {session.relative && (
                    <span className="text-[12px] text-foreground/50">
                      {session.relative}
                    </span>
                  )}
                </div>
                <p className="truncate text-[15px] text-foreground">
                  {session.title}
                  {session.authorName && (
                    <span className="ml-2 inline-flex items-center rounded-full border border-foreground/15 bg-foreground/5 px-2 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wide text-foreground/55">
                      {session.authorName}
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[12px] tabular-nums text-foreground/55">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="size-3" />
                    {session.durationMinutes} min
                  </span>{" "}
                  <span className="mx-1 text-foreground/25">/</span>
                  <span className="inline-flex items-center gap-1">
                    <Dumbbell className="size-3" />
                    {session.exerciseCount}{" "}
                    {session.exerciseCount === 1 ? "ejercicio" : "ejercicios"}
                  </span>
                </p>
              </div>
            </>
          );

          return (
            <li
              key={session.id}
              className={cn(
                "relative rounded-lg border bg-white shadow-[0_12px_36px_rgba(5,5,5,0.035)] transition-colors dark:bg-white/[0.045]",
                isSelected
                  ? "border-[#D6FF38] bg-[#D6FF38]/10"
                  : "border-[#050505]/10 hover:border-[#D6FF38]/70 dark:border-white/10"
              )}
            >
              {selecting ? (
                <button
                  type="button"
                  onClick={() => toggle(session.id)}
                  aria-pressed={isSelected}
                  className="flex w-full items-center gap-4 px-4 py-3.5 text-left"
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-md border",
                      isSelected
                        ? "border-[#050505] bg-[#050505] text-white dark:border-white dark:bg-white dark:text-[#050505]"
                        : "border-foreground/25"
                    )}
                  >
                    {isSelected && <Check className="size-4" strokeWidth={3} />}
                  </span>
                  {body}
                </button>
              ) : (
                <>
                  <Link
                    href={`/sessions/${session.id}${navQuery ? `?${navQuery}` : ""}`}
                    className="group flex items-center gap-4 px-4 py-3.5"
                  >
                    {body}
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border text-foreground/30 transition-colors group-hover:border-[#D6FF38]/70 group-hover:bg-[#D6FF38]/15 group-hover:text-foreground">
                      <ArrowRight className="size-4" />
                    </span>
                  </Link>
                  {session.status === "cancelled" ? (
                    <button
                      type="button"
                      aria-label="Recuperar sesión"
                      title="Recuperar sesión"
                      disabled={recovering === session.id}
                      onClick={() => void recoverSession(session.id)}
                      className="absolute right-[4.25rem] top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-[#D6FF38]/15 hover:text-foreground disabled:opacity-50"
                    >
                      {recovering === session.id ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <RotateCcw className="size-4" />
                      )}
                    </button>
                  ) : (
                    <SessionFavoriteToggle
                      sessionId={session.id}
                      sessionTitle={session.title}
                      initialFavorited={session.favorited}
                      className="absolute right-[4.25rem] top-1/2 -translate-y-1/2"
                    />
                  )}
                </>
              )}
            </li>
          );
        })}
      </ul>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={
          count === 1 ? "¿Eliminar 1 sesión?" : `¿Eliminar ${count} sesiones?`
        }
        description="Se borrarán con su plan de ejercicios y sus notas. Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => void deleteSelected()}
      />
    </div>
  );
}
