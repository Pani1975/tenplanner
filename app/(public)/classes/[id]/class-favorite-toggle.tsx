"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClassListPicker } from "./class-list-picker";

/**
 * Corazón de la ficha de clase: abre el selector de listas. Si al abrirlo
 * no se elige ninguna lista explícita, la clase queda guardada igualmente
 * en la lista "Favoritos" por defecto (lo gestiona ClassListPicker).
 */
export function ClassFavoriteToggle({
  classId,
  className,
  initialFavorited,
}: {
  classId: string;
  /** Nombre de la clase, mostrado en el diálogo. */
  className?: string;
  initialFavorited: boolean;
}) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={favorited ? "Gestionar listas" : "Añadir a favoritos"}
        title={favorited ? "Guardada en listas" : "Añadir a favoritos"}
        className={cn(
          "flex size-10 items-center justify-center rounded-full border transition-colors",
          favorited
            ? "border-[#D6FF38]/60 bg-[#D6FF38]/15 text-[#D6FF38]"
            : "border-white/16 text-white/55 hover:border-[#D6FF38] hover:text-[#D6FF38]"
        )}
      >
        <Heart
          className={cn("size-4", favorited && "fill-current")}
          strokeWidth={1.6}
        />
      </button>

      {open && (
        <ClassListPicker
          classId={classId}
          className={className}
          onClose={() => setOpen(false)}
          onFavoritedChange={setFavorited}
        />
      )}
    </>
  );
}
