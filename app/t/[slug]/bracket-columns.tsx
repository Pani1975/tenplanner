import { cn } from "@/lib/utils";

/**
 * Columnas de un cuadro de eliminatoria con cada partido centrado entre los
 * dos de la ronda anterior que lo alimentan, y líneas que los unen.
 * Solo presentación (sin hooks): vale para servidor y cliente.
 * Cada ronda tiene la mitad de partidos que la anterior; todas las columnas
 * miden lo mismo y cada partido ocupa el mismo alto dentro de su columna,
 * así que los centros quedan alineados.
 */
export function BracketColumns({
  rounds,
}: {
  rounds: { key: string | number; title: string; items: React.ReactNode[] }[];
}) {
  return (
    <div className="-mx-4 flex snap-x overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {rounds.map((r, ri) => {
        const first = ri === 0;
        const last = ri === rounds.length - 1;
        return (
          <div
            key={r.key}
            className={cn(
              "flex w-64 shrink-0 snap-start flex-col",
              !last && "mr-6"
            )}
          >
            <h3 className="pb-2 pt-1 text-xs font-bold uppercase text-foreground/60">
              {r.title}
            </h3>
            <div className="flex flex-1 flex-col">
              {r.items.map((item, i) => (
                <div
                  key={i}
                  className={cn(
                    "relative flex flex-1 flex-col justify-center py-1.5",
                    // Entrada desde la ronda anterior.
                    !first &&
                      "before:absolute before:right-full before:top-1/2 before:w-3 before:border-t-2 before:border-foreground/20 before:content-['']",
                    // Salida hacia el partido siguiente: el de arriba baja y el
                    // de abajo sube hasta el punto medio entre los dos.
                    !last &&
                      "after:absolute after:left-full after:w-3 after:border-r-2 after:border-foreground/20 after:content-['']",
                    !last &&
                      (i % 2 === 0
                        ? "after:top-1/2 after:h-1/2 after:border-t-2"
                        : "after:top-0 after:h-1/2 after:border-b-2")
                  )}
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
