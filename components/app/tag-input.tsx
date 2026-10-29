"use client";

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

// Etiquetas libres: se añaden con Enter o coma y se quitan con la X o con
// Retroceso en el campo vacío. Mismo comportamiento que en las sesiones.

interface TagInputProps {
  id?: string;
  value: string[];
  onChange: (tags: string[]) => void;
  max?: number;
  placeholder?: string;
  className?: string;
}

export function TagInput({
  id,
  value,
  onChange,
  max = 10,
  placeholder = "Ej: saque, control…",
  className,
}: TagInputProps) {
  const [input, setInput] = useState("");

  function add(raw: string) {
    const tag = raw.trim();
    if (!tag || tag.length > 30 || value.length >= max) return;
    if (value.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    onChange([...value, tag]);
    setInput("");
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(input);
    } else if (e.key === "Backspace" && input === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className={className}>
      {value.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.map((tag, i) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full border border-brand/20 bg-brand/10 px-2.5 py-1 text-xs text-brand"
            >
              {tag}
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                aria-label={`Quitar etiqueta ${tag}`}
                className="opacity-70 hover:opacity-100"
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        id={id}
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={() => add(input)}
        placeholder={placeholder}
        maxLength={30}
        disabled={value.length >= max}
        className="h-10 w-full rounded-lg border border-foreground/15 bg-background/70 px-3 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus:border-[#D6FF38]/70 focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/20 disabled:opacity-50"
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Pulsa Enter o coma para añadir · {value.length}/{max}
      </p>
    </div>
  );
}
