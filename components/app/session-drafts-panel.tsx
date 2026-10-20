"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Clock3, FilePenLine, Trash2, FileX } from "lucide-react";
import { SessionInfoSummary } from "@/components/app/session-info-summary";
import {
  listSessionDrafts,
  removeSessionDraft,
  type SessionDraft,
} from "@/lib/drafts";

function formatUpdatedAt(value: string) {
  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

interface Props {
  showEmptyState?: boolean;
}

export function SessionDraftsPanel({ showEmptyState = false }: Props) {
  const [drafts, setDrafts] = useState<SessionDraft[]>([]);
  const [loaded, setLoaded] = useState(false);
  const refreshRef = useRef<() => void>(null!);

  useEffect(() => {
    async function refresh() {
      setDrafts(await listSessionDrafts());
      setLoaded(true);
    }
    refreshRef.current = () => void refresh();
    refreshRef.current();

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") refreshRef.current();
    }

    window.addEventListener("focus", refreshRef.current);
    window.addEventListener("tenplanner:drafts-updated", refreshRef.current);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("focus", refreshRef.current);
      window.removeEventListener(
        "tenplanner:drafts-updated",
        refreshRef.current
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  async function handleRemove(id: string) {
    await removeSessionDraft(id);
    setDrafts(await listSessionDrafts());
  }

  if (!loaded) return null;

  if (drafts.length === 0) {
    if (!showEmptyState) return null;
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center border-t border-foreground/15">
        <div className="size-14 rounded-2xl bg-foreground/5 border border-foreground/10 flex items-center justify-center">
          <FileX className="size-6 text-foreground/20" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground/40">
            Sin borradores
          </p>
          <p className="text-sm text-foreground/30 mt-1">
            Las sesiones que guardes como borrador aparecerán aquí.
          </p>
        </div>
        <Link
          href="/sessions/new"
          className="inline-flex items-center gap-2 rounded-lg bg-brand text-brand-foreground px-4 py-2 text-[13px] font-semibold hover:bg-brand/90 transition-colors mt-1"
        >
          Crear sesión
        </Link>
      </div>
    );
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/40">
          Borradores · {drafts.length.toString().padStart(2, "0")}
        </p>
      </div>
      <div className="space-y-2">
        {drafts.map((draft, i) => (
          <div
            key={draft.id}
            className="flex items-start gap-3 rounded-xl border border-foreground/10 bg-foreground/[0.02] px-4 py-3"
          >
            <span className="font-sans text-[9px] tabular-nums text-foreground/30 shrink-0">
              {(i + 1).toString().padStart(2, "0")}
            </span>
            <div className="flex-1 min-w-0 space-y-0.5">
              <p className="text-[14px] font-heading text-foreground truncate">
                {draft.title || "Sesión sin título"}
              </p>
              <p className="flex items-center gap-1.5 text-[11px] text-foreground/45">
                <Clock3 className="size-3" />
                {formatUpdatedAt(draft.updatedAt)}
              </p>
              <SessionInfoSummary
                compact
                objective={draft.payload?.objective}
                material={draft.payload?.material}
                observations={draft.payload?.observations}
                tags={
                  Array.isArray(draft.payload?.tags) ? draft.payload.tags : []
                }
                className="pt-1.5"
              />
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Link
                href={`/sessions/new?draft=${draft.id}`}
                className="inline-flex items-center gap-1 rounded-lg bg-brand text-brand-foreground px-2.5 py-1.5 text-[12px] font-medium hover:bg-brand/90 transition-colors"
              >
                <FilePenLine className="size-3" />
                Continuar
              </Link>
              <button
                type="button"
                onClick={() => void handleRemove(draft.id)}
                className="inline-flex items-center gap-1 rounded-lg border border-foreground/15 px-2 py-1.5 text-[12px] text-foreground/50 hover:border-red-500/30 hover:text-red-500 transition-colors"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
