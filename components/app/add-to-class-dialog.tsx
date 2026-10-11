"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, GraduationCap, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DraftClassOption = {
  id: string;
  name: string;
  duracionMinutes: number;
};

const BLOCKS: Array<{ order: 1 | 2 | 3; label: string }> = [
  { order: 1, label: "Bloque inicial" },
  { order: 2, label: "Bloque principal" },
  { order: 3, label: "Bloque final" },
];

/**
 * Añadir un ejercicio a una clase en borrador del usuario, o crear un
 * borrador nuevo que lo incluya.
 */
export function AddToClassDialog({
  open,
  onOpenChange,
  exerciseId,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseId: string;
  /** Nombre del ejercicio, para el título. */
  label: string;
}) {
  const [options, setOptions] = useState<DraftClassOption[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [blockOrder, setBlockOrder] = useState<1 | 2 | 3>(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setOptions(null);
    setLoadError(false);
    fetch("/api/classes?tab=drafts", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json: { data: DraftClassOption[] }) => {
        if (cancelled) return;
        setOptions(json.data);
        if (json.data.length === 0) setCreating(true);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setCreating(false);
      setNewName("");
      setBlockOrder(2);
      setError(null);
      setDone(null);
    }
  }, [open]);

  const canSubmit = creating ? !!newName.trim() : !!selected;

  async function handleAdd() {
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      if (!creating && selected) {
        const res = await fetch(`/api/classes/${selected}/exercises`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ exerciseId, blockOrder }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            error?: unknown;
          };
          setError(
            typeof data.error === "string"
              ? data.error
              : "No se pudo añadir. Inténtalo de nuevo."
          );
          return;
        }
        const option = options?.find((o) => o.id === selected);
        setDone({ id: selected, name: option?.name ?? "la clase" });
      } else {
        const name = newName.trim();
        const res = await fetch("/api/classes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            duracionMinutes: 60,
            status: "draft",
            blocks: [
              {
                orderIndex: blockOrder,
                items: [{ kind: "exercise", exerciseId }],
              },
            ],
          }),
        });
        if (!res.ok) {
          setError("No se pudo crear la clase. Inténtalo de nuevo.");
          return;
        }
        const { data } = (await res.json()) as { data: { id: string } };
        setDone({ id: data.id, name });
      }
    } catch {
      setError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Añadir a una clase</DialogTitle>
          <DialogDescription>“{label}”</DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#D6FF38] text-[#050505]">
              <Check className="size-6" />
            </div>
            <p className="text-sm text-foreground">
              Añadido a <strong>{done.name}</strong> (borrador).
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href={`/classes/${done.id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#D6FF38] px-4 py-2 text-sm font-bold text-[#050505] hover:bg-[#c8ef2f]"
              >
                Seguir configurando la clase
              </Link>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                Cerrar
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Mis clases en borrador
            </p>

            <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {options === null && !loadError ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Cargando clases…
                </div>
              ) : loadError ? (
                <p className="py-8 text-center text-sm text-destructive">
                  No se pudieron cargar tus clases en borrador.
                </p>
              ) : (
                <>
                  {options?.map((option) => {
                    const isSelected = !creating && selected === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => {
                          setSelected(option.id);
                          setCreating(false);
                        }}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                          isSelected ? "bg-[#D6FF38]/20" : "hover:bg-muted/60"
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full border",
                            isSelected
                              ? "border-[#050505] bg-[#050505] text-white dark:border-white dark:bg-white dark:text-[#050505]"
                              : "border-border"
                          )}
                        >
                          {isSelected && <Check className="size-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-foreground">
                            {option.name}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {option.duracionMinutes} min
                          </span>
                        </span>
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(true);
                      setSelected(null);
                    }}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                      creating ? "bg-[#D6FF38]/20" : "hover:bg-muted/60"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-full border",
                        creating
                          ? "border-[#050505] bg-[#050505] text-white dark:border-white dark:bg-white dark:text-[#050505]"
                          : "border-border"
                      )}
                    >
                      <Plus className="size-3" />
                    </span>
                    <span className="text-sm font-semibold text-foreground">
                      Nueva clase en borrador
                    </span>
                  </button>
                </>
              )}
            </div>

            {creating && (
              <div className="space-y-1.5">
                <label
                  htmlFor="new-draft-class-name"
                  className="text-xs font-bold uppercase tracking-wider text-muted-foreground"
                >
                  Nombre de la clase
                </label>
                <input
                  id="new-draft-class-name"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  maxLength={255}
                  placeholder="Ej.: Minitenis sábado"
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-[#D6FF38]"
                />
                <p className="text-xs text-muted-foreground">
                  Se crea con 60 minutos; puedes cambiarlo al terminar de
                  configurarla.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                ¿En qué bloque?
              </p>
              <div className="flex flex-wrap gap-2">
                {BLOCKS.map((block) => (
                  <button
                    key={block.order}
                    type="button"
                    onClick={() => setBlockOrder(block.order)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                      blockOrder === block.order
                        ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
                        : "border-border text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {block.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Se añade al final del bloque. Luego puedes reordenarlo desde
                Editar clase.
              </p>
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}

            <div className="flex justify-end border-t border-border pt-4">
              <button
                type="button"
                onClick={handleAdd}
                disabled={!canSubmit || saving}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D6FF38] px-5 py-2.5 text-sm font-bold text-[#050505] transition-colors hover:bg-[#c8ef2f] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <GraduationCap className="size-4" />
                )}
                {creating ? "Crear borrador y añadir" : "Añadir a la clase"}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Botón que abre el diálogo. */
export function AddToClassButton({
  exerciseId,
  label,
  variant = "pill",
  className,
}: {
  exerciseId: string;
  label: string;
  /** "icon": botón compacto para la cabecera de las tarjetas. */
  variant?: "pill" | "icon";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setOpen(true);
          }}
          title="Añadir a una clase en borrador"
          aria-label="Añadir a una clase en borrador"
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-[#D6FF38]",
            className
          )}
        >
          <GraduationCap className="size-4" strokeWidth={1.7} />
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-[#050505]/12 bg-[#F4F4F1] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-[#D6FF38] hover:bg-[#D6FF38]/15 dark:border-white/10 dark:bg-[#050505]",
            className
          )}
        >
          <GraduationCap className="size-4 text-brand" strokeWidth={1.6} />
          Añadir a clase
        </button>
      )}
      <AddToClassDialog
        open={open}
        onOpenChange={setOpen}
        exerciseId={exerciseId}
        label={label}
      />
    </>
  );
}
