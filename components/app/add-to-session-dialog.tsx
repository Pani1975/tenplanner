"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Check, Loader2, Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";

type SessionOption = {
  id: string;
  title: string;
  scheduledAt: string;
  status: "scheduled" | "completed" | "cancelled";
};

const BLOCKS: Array<{ order: 1 | 2 | 3; label: string }> = [
  { order: 1, label: "Bloque inicial" },
  { order: 2, label: "Bloque principal" },
  { order: 3, label: "Bloque final" },
];

function formatDate(iso: string, loc: string = "es-ES") {
  return new Intl.DateTimeFormat(loc, {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/**
 * Añadir uno o varios ejercicios a una sesión ya creada (o crear una nueva).
 */
export function AddToSessionDialog({
  open,
  onOpenChange,
  exerciseIds,
  label,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exerciseIds: string[];
  /** Nombre del ejercicio o de la lista, para el título. */
  label: string;
}) {
  const term = useTerm();
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_app_addtosessiondialog");
  const [includePast, setIncludePast] = useState(false);
  const [options, setOptions] = useState<SessionOption[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [blockOrder, setBlockOrder] = useState<1 | 2 | 3>(2);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<SessionOption | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setOptions(null);
    setLoadError(false);
    fetch(`/api/sessions/options${includePast ? "?past=1" : ""}`, {
      cache: "no-store",
    })
      .then((res) => (res.ok ? res.json() : Promise.reject()))
      .then((json: { data: SessionOption[] }) => {
        if (!cancelled) setOptions(json.data);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open, includePast]);

  useEffect(() => {
    if (!open) {
      setSelected(null);
      setBlockOrder(2);
      setError(null);
      setDone(null);
      setIncludePast(false);
    }
  }, [open]);

  async function handleAdd() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sessions/${selected}/add-exercises`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exerciseIds, blockOrder }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(data.error ?? tx("noSePudoAnadir"));
        return;
      }
      setDone(options?.find((o) => o.id === selected) ?? null);
    } catch {
      setError(tx("errorDeRedIntentalo"));
    } finally {
      setSaving(false);
    }
  }

  const count = exerciseIds.length;
  const newSessionHref = `/sessions/new?exercises=${exerciseIds.join(",")}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{tx("anadirAUnaSesion")}</DialogTitle>
          <DialogDescription>
            {count === 1 ? `“${label}”` : tx("v1EjerciciosDeV2", { v1: count, v2: label })}
          </DialogDescription>
        </DialogHeader>

        {done ? (
          <div className="space-y-4 py-2 text-center">
            <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-[#D6FF38] text-[#050505]">
              <Check className="size-6" />
            </div>
            <p className="text-sm text-foreground">
              {count === 1 ? "Añadido" : tx("v1EjerciciosAnadidos", { v1: count })} a{" "}
              <strong>{done.title}</strong>.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              <Link
                href={`/sessions/${done.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-[#D6FF38] px-4 py-2 text-sm font-bold text-[#050505] hover:bg-[#c8ef2f]"
              >
                {tx("verSesion")}
              </Link>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
              >
                {tx("cerrar")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {includePast ? tx("todasLasSesiones") : "Sesiones programadas"}
              </p>
              <button
                type="button"
                onClick={() => setIncludePast((v) => !v)}
                className="text-xs font-semibold text-brand hover:underline"
              >
                {includePast ? "Solo próximas" : tx("verTambienPasadas")}
              </button>
            </div>

            <div className="max-h-64 divide-y divide-border overflow-y-auto rounded-lg border border-border">
              {options === null && !loadError ? (
                <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  {tx("cargandoSesiones")}
                </div>
              ) : loadError ? (
                <p className="py-8 text-center text-sm text-destructive">
                  {tx("noSePudieronCargar")}
                </p>
              ) : options && options.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {tx("noTienesSesionesProgramadas")}
                </p>
              ) : (
                options?.map((option) => {
                  const isSelected = selected === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setSelected(option.id)}
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
                          {option.title}
                        </span>
                        <span className="block text-xs capitalize text-muted-foreground">
                          {formatDate(option.scheduledAt, intlLocale)}
                          {option.status === "completed" ? tx("completada") : ""}
                        </span>
                      </span>
                    </button>
                  );
                })
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {tx("enQueBloque")}
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
                    {term(block.label)}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {tx("seAnadeAlFinal")}
              </p>
            </div>

            {error && (
              <p className="text-sm font-medium text-destructive">{error}</p>
            )}

            <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Link
                href={newSessionHref}
                className="inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
              >
                <Plus className="size-4" />
                {tx("crearSesionNueva")}
              </Link>
              <button
                type="button"
                onClick={handleAdd}
                disabled={!selected || saving}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#D6FF38] px-5 py-2.5 text-sm font-bold text-[#050505] transition-colors hover:bg-[#c8ef2f] disabled:opacity-50"
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarPlus className="size-4" />
                )}
                {tx("anadirALaSesion")}
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Botón que abre el diálogo (para usar en páginas de servidor). */
export function AddToSessionButton({
  exerciseIds,
  label,
  variant = "pill",
  className,
}: {
  exerciseIds: string[];
  label: string;
  variant?: "pill" | "icon";
  className?: string;
}) {
  const tx = useTranslations("ui.s_app_addtosessiondialog");
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
          title={tx("anadirAUnaSesion")}
          aria-label={tx("anadirAUnaSesion")}
          className={cn(
            "flex size-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-[#D6FF38]",
            className
          )}
        >
          <CalendarPlus className="size-4" strokeWidth={1.7} />
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
          <CalendarPlus className="size-4 text-brand" strokeWidth={1.6} />
          {tx("anadirASesion")}
        </button>
      )}
      <AddToSessionDialog
        open={open}
        onOpenChange={setOpen}
        exerciseIds={exerciseIds}
        label={label}
      />
    </>
  );
}
