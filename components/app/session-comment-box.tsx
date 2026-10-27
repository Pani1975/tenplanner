"use client";

import { useRef, useState } from "react";
import { Check, Loader2, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface SessionCommentBoxProps {
  /** Comentario guardado (null/"" si no hay). */
  value: string | null | undefined;
  /** Guarda el comentario; devuelve true si se guardó bien. */
  onSave: (comment: string | null) => Promise<boolean>;
  /** Solo lectura (sesión de otro monitor): muestra el texto si existe. */
  readOnly?: boolean;
  /** Texto del botón cuando aún no hay comentario. */
  addLabel?: string;
  placeholder?: string;
  maxLength?: number;
  /** Abre el editor desde el principio (p. ej. el comentario general). */
  alwaysOpen?: boolean;
  className?: string;
}

/**
 * Caja de comentario de texto libre: un botón "Añadir comentario" que abre
 * un campo; se guarda al salir del campo o con "Guardar", antes o después de
 * completar la sesión.
 */
export function SessionCommentBox({
  value,
  onSave,
  readOnly = false,
  addLabel = "Añadir comentario",
  placeholder = "Escribe un comentario…",
  maxLength = 2000,
  alwaysOpen = false,
  className,
}: SessionCommentBoxProps) {
  const [saved, setSaved] = useState(value?.trim() ?? "");
  const [draft, setDraft] = useState(value ?? "");
  const [open, setOpen] = useState(alwaysOpen || !!value?.trim());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const savingRef = useRef(false);

  if (readOnly) {
    if (!saved) return null;
    return (
      <p
        className={cn(
          "whitespace-pre-line rounded-md border border-border/60 bg-muted/30 px-3 py-2 text-xs leading-relaxed text-foreground/80",
          className
        )}
      >
        {saved}
      </p>
    );
  }

  async function save() {
    const next = draft.trim();
    if (next === saved || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError(false);
    const ok = await onSave(next || null);
    savingRef.current = false;
    setSaving(false);
    if (ok) {
      setSaved(next);
      setDraft(next);
      setJustSaved(true);
      window.setTimeout(() => setJustSaved(false), 2000);
      if (!next && !alwaysOpen) setOpen(false);
    } else {
      setError(true);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground",
          className
        )}
      >
        <MessageSquare className="size-3" />
        {addLabel}
      </button>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      <textarea
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setJustSaved(false);
        }}
        onBlur={() => void save()}
        maxLength={maxLength}
        rows={3}
        placeholder={placeholder}
        aria-label={addLabel}
        className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/30"
      />
      <div className="flex items-center justify-end gap-2 text-[11px]">
        {error && (
          <span className="text-destructive">
            No se pudo guardar. Inténtalo de nuevo.
          </span>
        )}
        {justSaved && !saving && (
          <span className="inline-flex items-center gap-1 text-brand">
            <Check className="size-3" />
            Guardado
          </span>
        )}
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving || draft.trim() === saved}
          className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
        >
          {saving && <Loader2 className="size-3 animate-spin" />}
          Guardar
        </button>
      </div>
    </div>
  );
}
