"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  IMPORT_MAX_CHARS,
  toClassBody,
  validateImportInput,
} from "@/lib/import/schema";
import type { ImportedClass, ImportedExercise } from "@/lib/import/schema";

type Kind = "exercises" | "classes";
type Item = ImportedExercise | ImportedClass;

interface Props {
  kind: Kind;
  /** Nombre del espacio donde se guardará: "tu espacio" o el del club. */
  spaceLabel: string;
  className?: string;
  /** Permite subir un PDF, Excel o CSV (por ahora solo en la zona del club). */
  allowFile?: boolean;
}

const COPY = {
  exercises: {
    title: "Importar ejercicios con Ten Planner",
    placeholder:
      "Pega o escribe aquí uno o varios ejercicios: nombre, cómo se hace, duración, material, variantes…",
    one: "ejercicio",
    many: "ejercicios",
    drafts: "/exercises?tab=drafts",
  },
  classes: {
    title: "Importar clases con Ten Planner",
    placeholder:
      "Pega o escribe aquí una o varias clases: objetivos, calentamiento, parte principal, vuelta a la calma, duración…",
    one: "clase",
    many: "clases",
    drafts: "/classes?tab=drafts",
  },
} as const;

function nameOf(item: Item) {
  return item.name;
}

export function ImportTextDialog({
  kind,
  spaceLabel,
  className,
  allowFile = false,
}: Props) {
  const router = useRouter();
  const copy = COPY[kind];
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState<string[]>([]);

  function reset() {
    setText("");
    setFile(null);
    setNotes([]);
    setItems(null);
    setError(null);
  }

  async function convert() {
    const checked = validateImportInput(!!file, text);
    if (!checked.ok) {
      setError(checked.error);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      let init: RequestInit;
      if (file) {
        // Se leen los bytes antes de enviar: así se detecta un archivo que el
        // navegador no puede leer (p. ej. uno de OneDrive sin descargar) y se
        // manda una copia en memoria en vez de una referencia al disco.
        const bytes = await file.arrayBuffer();
        if (bytes.byteLength === 0) {
          setError(
            "El navegador no puede leer el archivo (llega vacío). Si está en OneDrive o la nube, descárgalo al equipo y vuelve a elegirlo."
          );
          return;
        }
        const form = new FormData();
        form.append("kind", kind);
        form.append(
          "file",
          new File([bytes], file.name, {
            type: file.type || "application/octet-stream",
          })
        );
        // Con archivo, el texto son indicaciones opcionales.
        form.append("text", text);
        init = { method: "POST", body: form };
      } else {
        init = {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, text }),
        };
      }
      const res = await fetch("/api/import-text", init);
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        notes?: string[];
        exercises?: ImportedExercise[];
        classes?: ImportedClass[];
        remaining?: number;
      };
      if (!res.ok) {
        setError(data.error ?? "No he podido convertir el texto.");
        return;
      }
      setItems((kind === "exercises" ? data.exercises : data.classes) ?? []);
      setRemaining(data.remaining ?? null);
      setNotes(data.notes ?? []);
    } catch {
      setError("No hay conexión. Comprueba tu red e inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  function patch(index: number, change: Partial<Item>) {
    setItems((prev) =>
      prev ? prev.map((it, i) => (i === index ? ({ ...it, ...change } as Item) : it)) : prev
    );
  }

  async function save() {
    if (!items?.length) return;
    setBusy(true);
    setError(null);
    let saved = 0;
    try {
      for (const item of items) {
        const res =
          kind === "exercises"
            ? await fetch("/api/exercise-drafts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload: item }),
              })
            : await fetch("/api/classes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(toClassBody(item as ImportedClass)),
              });
        if (!res.ok) throw new Error("save");
        saved += 1;
      }
      setOpen(false);
      reset();
      router.push(copy.drafts);
      router.refresh();
    } catch {
      // Los que ya se guardaron salen de la lista para no duplicarlos.
      setItems((prev) => (prev ? prev.slice(saved) : prev));
      setError(
        saved > 0
          ? `Se guardaron ${saved} como borrador y falló uno. Revisa la lista e inténtalo de nuevo con el resto.`
          : "No se pudo guardar. Inténtalo de nuevo."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className={
              className ??
              "inline-flex min-h-11 items-center gap-2 rounded-full border border-[#D6FF38]/60 px-5 text-[13px] font-semibold text-[#D6FF38] transition hover:bg-[#D6FF38] hover:text-[#050505]"
            }
          />
        }
      >
        <Sparkles className="size-4" />
        Importar con Ten Planner
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>
            Se guardarán como borradores en {spaceLabel}. Nada se publica hasta
            que lo revises y lo guardes tú.
          </DialogDescription>
        </DialogHeader>

        {items === null ? (
          <div className="space-y-3">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={copy.placeholder}
              rows={12}
              maxLength={IMPORT_MAX_CHARS + 1000}
              disabled={busy}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                Se importará el archivo «{file.name}». Lo que escribas arriba
                se usa solo como indicaciones extra (opcional).
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span
                className={text.length > IMPORT_MAX_CHARS ? "text-red-600" : ""}
              >
                {text.length.toLocaleString("es-ES")} /{" "}
                {IMPORT_MAX_CHARS.toLocaleString("es-ES")} caracteres
              </span>
              {!allowFile && (
                <span>Solo texto por ahora (PDF y Excel, más adelante).</span>
              )}
            </div>
            {allowFile && (
              <div className="space-y-1 rounded-lg border border-dashed p-3">
                <label className="text-sm font-medium" htmlFor="import-file">
                  O sube un documento (PDF, Excel o CSV)
                </label>
                <input
                  id="import-file"
                  type="file"
                  accept=".pdf,.xlsx,.csv,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  disabled={busy}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="block w-full text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Máximo 4 MB (PDF hasta 30 páginas). El archivo no se guarda:
                  solo se usa para generar los borradores.
                </p>
              </div>
            )}
            {error ? (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            ) : null}
            <Button
              type="button"
              onClick={convert}
              disabled={busy || (!file && text.trim().length === 0)}
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              {busy ? "Convirtiendo…" : "Convertir"}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              Esto es lo que he entendido ({items.length}{" "}
              {items.length === 1 ? copy.one : copy.many}). Edita el nombre o
              quita lo que no quieras; el resto de campos podrás ajustarlo
              al abrir cada borrador.
            </p>
            {notes.map((n) => (
              <p
                key={n}
                role="note"
                className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
              >
                {n}
              </p>
            ))}
            <ul className="space-y-3">
              {items.map((item, i) => (
                <li key={i} className="space-y-2 rounded-lg border p-3">
                  <div className="flex items-start gap-2">
                    <input
                      aria-label="Nombre"
                      className="min-h-11 flex-1 rounded-md border px-3 text-sm font-semibold"
                      value={nameOf(item)}
                      maxLength={255}
                      onChange={(e) => patch(i, { name: e.target.value })}
                    />
                    <button
                      type="button"
                      aria-label={`Quitar ${nameOf(item)}`}
                      className="inline-flex size-11 items-center justify-center rounded-md border hover:bg-red-50"
                      onClick={() =>
                        setItems((prev) =>
                          prev ? prev.filter((_, j) => j !== i) : prev
                        )
                      }
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <ItemSummary item={item} />
                  {"blocks" in item ? (
                    <ClassItemsLinker
                      cls={item}
                      onChange={(blocks) => patch(i, { blocks })}
                    />
                  ) : null}
                </li>
              ))}
            </ul>
            {error ? (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            ) : null}
            {remaining !== null ? (
              <p className="text-xs text-muted-foreground">
                Te quedan {remaining} importaciones hoy.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={save}
                disabled={busy || items.length === 0 || items.some((it) => !nameOf(it).trim())}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : null}
                Guardar {items.length}{" "}
                {items.length === 1 ? "borrador" : "borradores"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setItems(null)}
                disabled={busy}
              >
                Volver al texto
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ItemSummary({ item }: { item: Item }) {
  if ("duracionMinutes" in item) {
    const n = item.blocks.reduce((s, b) => s + b.items.length, 0);
    return (
      <p className="text-xs text-muted-foreground">
        {item.duracionMinutes} min · {item.blocks.length} bloques · {n}{" "}
        actividades
        {item.objetivos ? ` · ${item.objetivos.slice(0, 140)}` : ""}
      </p>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      {item.durationMinutes} min
      {item.niveles.length ? ` · ${item.niveles.join(", ")}` : ""}
      {item.golpes.length ? ` · ${item.golpes.join(", ")}` : ""}
      {item.description ? ` · ${item.description.slice(0, 140)}` : ""}
    </p>
  );
}

const BLOCK_LABELS: Record<number, string> = {
  1: "Bloque inicial",
  2: "Bloque principal",
  3: "Bloque final",
};

/**
 * Actividades de una clase importada con el ejercicio de la biblioteca que
 * se le ha sugerido. El monitor elige un ejercicio o la deja como texto.
 */
function ClassItemsLinker({
  cls,
  onChange,
}: {
  cls: ImportedClass;
  onChange: (blocks: ImportedClass["blocks"]) => void;
}) {
  const linked = cls.blocks.reduce(
    (n, b) => n + b.items.filter((it) => it.exerciseId).length,
    0
  );
  const total = cls.blocks.reduce((n, b) => n + b.items.length, 0);

  function setExercise(bi: number, ii: number, exerciseId: string | null) {
    onChange(
      cls.blocks.map((b, j) =>
        j !== bi
          ? b
          : {
              ...b,
              items: b.items.map((it, k) =>
                k === ii ? { ...it, exerciseId } : it
              ),
            }
      )
    );
  }

  return (
    <details className="text-xs">
      <summary className="cursor-pointer select-none py-1 font-medium">
        Actividades · {linked} de {total} vinculadas a la biblioteca
      </summary>
      <div className="mt-2 space-y-3">
        {cls.blocks.map((b, bi) => (
          <div key={bi} className="space-y-1.5">
            <p className="font-semibold uppercase tracking-wide text-muted-foreground">
              {b.title || BLOCK_LABELS[b.orderIndex]}
            </p>
            {b.items.map((it, ii) => (
              <div
                key={ii}
                className="grid gap-1 sm:grid-cols-[1fr_minmax(0,16rem)] sm:items-center"
              >
                <span>
                  {it.title || it.freeText.slice(0, 60)}
                  {it.durationMinutes ? ` · ${it.durationMinutes} min` : ""}
                </span>
                {it.suggestions.length > 0 ? (
                  <select
                    aria-label={`Ejercicio de la biblioteca para ${it.title ?? "la actividad"}`}
                    className="min-h-9 rounded-md border bg-background px-2"
                    value={it.exerciseId ?? ""}
                    onChange={(e) =>
                      setExercise(bi, ii, e.target.value || null)
                    }
                  >
                    <option value="">Dejar como texto</option>
                    {it.suggestions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="text-muted-foreground">
                    {it.searchTerms
                      ? "Sin ejercicio parecido: texto"
                      : "Texto"}
                  </span>
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </details>
  );
}
