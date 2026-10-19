"use client";

import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  ASPECTS,
  BALLS,
  type AspectId,
  type BallId,
  type ObjectiveItem,
} from "@/lib/objectives-taxonomy";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

/** Estado del editor: crear un objetivo nuevo o editar uno existente. */
export type EditorState =
  | { mode: "create" }
  | { mode: "edit"; item: ObjectiveItem }
  | null;

export type EditorValues = {
  ball: BallId;
  aspect: AspectId;
  block: string;
  title: string;
  criterion: string;
};

export function ObjectiveEditor({
  state,
  description,
  defaultBall,
  blocks,
  onClose,
  onSubmit,
}: {
  state: EditorState;
  /** Texto bajo el título: a quién se aplicará el cambio. */
  description: string;
  defaultBall: BallId;
  blocks: ObjectiveItem[];
  onClose: () => void;
  onSubmit: (values: EditorValues) => Promise<boolean>;
}) {
  const editing = state?.mode === "edit" ? state.item : null;
  const [values, setValues] = useState<EditorValues>({
    ball: editing?.ball ?? defaultBall,
    aspect: editing?.aspect ?? "tecnico",
    block: editing?.block ?? "",
    title: editing?.title ?? "",
    criterion: editing?.criterion ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const knownBlocks = useMemo(
    () =>
      Array.from(
        new Set(
          blocks
            .filter((b) => b.ball === values.ball && b.aspect === values.aspect)
            .map((b) => b.block)
        )
      ),
    [blocks, values.ball, values.aspect]
  );

  const invalid =
    !values.title.trim() || (!editing && !values.block.trim()) || saving;

  async function submit() {
    if (invalid) return;
    setSaving(true);
    setError(null);
    try {
      const ok = await onSubmit({
        ...values,
        title: values.title.trim(),
        block: values.block.trim(),
        criterion: values.criterion.trim(),
      });
      if (!ok) throw new Error("failed");
      onClose();
    } catch {
      setError("No se pudo guardar. Inténtalo de nuevo.");
    } finally {
      setSaving(false);
    }
  }

  const selectClass =
    "h-10 w-full rounded-lg border border-input bg-background px-3 text-sm";

  return (
    <Dialog open={state !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {editing ? "Editar objetivo" : "Añadir objetivo"}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!editing && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="obj-ball">Bola / etapa</Label>
                  <select
                    id="obj-ball"
                    className={selectClass}
                    value={values.ball}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        ball: e.target.value as BallId,
                      }))
                    }
                  >
                    {BALLS.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.label} · {b.stage}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="obj-aspect">Aspecto</Label>
                  <select
                    id="obj-aspect"
                    className={selectClass}
                    value={values.aspect}
                    onChange={(e) =>
                      setValues((v) => ({
                        ...v,
                        aspect: e.target.value as AspectId,
                      }))
                    }
                  >
                    {ASPECTS.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="obj-block">Golpe o bloque</Label>
                <Input
                  id="obj-block"
                  list="obj-blocks"
                  maxLength={80}
                  placeholder="Derecha, Servicio, Dobles…"
                  value={values.block}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, block: e.target.value }))
                  }
                />
                <datalist id="obj-blocks">
                  {knownBlocks.map((b) => (
                    <option key={b} value={b} />
                  ))}
                </datalist>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="obj-title">Objetivo</Label>
            <Textarea
              id="obj-title"
              rows={2}
              maxLength={200}
              value={values.title}
              onChange={(e) =>
                setValues((v) => ({ ...v, title: e.target.value }))
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="obj-criterion">Criterio de logro (opcional)</Label>
            <Input
              id="obj-criterion"
              maxLength={300}
              placeholder="Ej.: 7 de 10 golpes dentro de la pista"
              value={values.criterion}
              onChange={(e) =>
                setValues((v) => ({ ...v, criterion: e.target.value }))
              }
            />
          </div>
        </div>

        {error && (
          <p className="text-sm font-medium text-destructive">{error}</p>
        )}

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={invalid}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-brand px-5 py-2.5 text-sm font-bold text-brand-foreground transition-colors hover:bg-brand/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
