"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Descripción de un ejercicio dentro de un selector (sesión/clase): se ve en
 * dos líneas y se despliega al pulsar, para leerla completa sin salir del
 * editor (así no se pierde lo que se está creando).
 */
export function ExerciseQuickDescription({
  text,
  className,
}: {
  text: string | null | undefined;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const value = text?.trim();
  if (!value) return null;

  return (
    <div className={cn("min-w-0", className)}>
      <p
        className={cn(
          "text-[11px] leading-snug text-muted-foreground whitespace-pre-line break-words",
          !open && "line-clamp-2"
        )}
      >
        {value}
      </p>
      <button
        type="button"
        draggable={false}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        aria-expanded={open}
        className="mt-0.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-brand hover:underline"
      >
        {open ? "Ocultar descripción" : "Ver descripción"}
        <ChevronDown
          className={cn("size-3 transition-transform", open && "rotate-180")}
        />
      </button>
    </div>
  );
}
