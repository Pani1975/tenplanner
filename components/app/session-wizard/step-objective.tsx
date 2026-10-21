"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { ObjectivesPicker } from "@/components/objectives/objectives-picker";
import { appendObjectiveLines } from "@/lib/objectives-text";
import type { WizardState } from "./types";

interface StepObjectiveProps {
  state: WizardState;
  update: (patch: Partial<WizardState>) => void;
  errors: Partial<Record<keyof WizardState, string>>;
}

export function StepObjective({ state, update, errors }: StepObjectiveProps) {
  const [tagInput, setTagInput] = useState("");

  function addTag(raw: string) {
    const trimmed = raw.trim();
    if (!trimmed) return;
    if (trimmed.length > 30) return;
    const lower = trimmed.toLowerCase();
    if (state.tags.some((t) => t.toLowerCase() === lower)) return;
    if (state.tags.length >= 10) return;
    update({ tags: [...state.tags, trimmed] });
    setTagInput("");
  }

  function removeTag(idx: number) {
    update({ tags: state.tags.filter((_, i) => i !== idx) });
  }

  function onTagKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
    } else if (
      e.key === "Backspace" &&
      tagInput === "" &&
      state.tags.length > 0
    ) {
      removeTag(state.tags.length - 1);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label
            htmlFor="objective"
            className="block text-xs font-bold uppercase tracking-widest text-muted-foreground"
          >
            Objetivos{" "}
            <span className="text-[10px] normal-case tracking-normal font-normal text-muted-foreground">
              opcional · uno por línea
            </span>
          </label>
          <ObjectivesPicker
            currentText={state.objective}
            onAdd={(titles) =>
              update({
                objective: appendObjectiveLines(state.objective, titles).slice(
                  0,
                  2000
                ),
              })
            }
          />
        </div>
        <textarea
          id="objective"
          value={state.objective}
          onChange={(e) => update({ objective: e.target.value })}
          placeholder="Qué debe mejorar el alumno o grupo en esta sesión."
          rows={4}
          maxLength={2000}
          className="w-full px-4 py-3 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-colors text-foreground placeholder:text-muted-foreground/50 resize-y leading-relaxed"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label
            htmlFor="material"
            className="block text-xs font-bold uppercase tracking-widest text-muted-foreground"
          >
            Material{" "}
            <span className="text-[10px] normal-case tracking-normal font-normal text-muted-foreground">
              opcional
            </span>
          </label>
          <textarea
            id="material"
            value={state.material}
            onChange={(e) => update({ material: e.target.value })}
            placeholder="Conos, pelotas, marcas, cestas..."
            rows={4}
            maxLength={2000}
            className="w-full px-4 py-3 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-colors text-foreground placeholder:text-muted-foreground/50 resize-none leading-relaxed"
          />
        </div>

        <div className="space-y-2">
          <label
            htmlFor="observations"
            className="block text-xs font-bold uppercase tracking-widest text-muted-foreground"
          >
            Observaciones{" "}
            <span className="text-[10px] normal-case tracking-normal font-normal text-muted-foreground">
              opcional
            </span>
          </label>
          <textarea
            id="observations"
            value={state.observations}
            onChange={(e) => update({ observations: e.target.value })}
            placeholder="Adaptaciones, notas de seguridad o foco técnico."
            rows={4}
            maxLength={4000}
            className="w-full px-4 py-3 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 transition-colors text-foreground placeholder:text-muted-foreground/50 resize-none leading-relaxed"
          />
        </div>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="tag-input"
          className="block text-xs font-bold uppercase tracking-widest text-muted-foreground"
        >
          Etiquetas{" "}
          <span className="text-[10px] normal-case tracking-normal font-normal text-muted-foreground">
            max. 10
          </span>
        </label>
        <div className="flex flex-wrap gap-2 p-2.5 min-h-11 bg-background border border-border rounded-xl focus-within:ring-2 focus-within:ring-brand/40 focus-within:border-brand/50 transition-colors">
          {state.tags.map((tag, i) => (
            <span
              key={`${tag}-${i}`}
              className="inline-flex items-center gap-1 pl-2.5 pr-1 h-7 text-xs font-semibold bg-brand/10 text-brand rounded-full"
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(i)}
                className="size-5 rounded-full flex items-center justify-center hover:bg-brand/20 transition-colors"
                aria-label={`Eliminar etiqueta ${tag}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
          <input
            id="tag-input"
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={onTagKeyDown}
            onBlur={() => tagInput && addTag(tagInput)}
            placeholder={state.tags.length === 0 ? "Ej: saque, control..." : ""}
            disabled={state.tags.length >= 10}
            className="flex-1 min-w-[120px] h-7 px-1 text-sm bg-transparent focus:outline-none text-foreground placeholder:text-muted-foreground/50"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Pulsa Enter o coma para añadir - {state.tags.length}/10
        </p>
        {errors.tags && (
          <p className="text-xs text-destructive font-medium">{errors.tags}</p>
        )}
      </div>
    </div>
  );
}
