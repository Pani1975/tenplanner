"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export type TournamentTab = {
  id: string;
  label: string;
  content: React.ReactNode;
};

/**
 * Botones de sección de la página del torneo (cuadro, orden de juego,
 * noticias, imágenes, inscritos, inscripción). Se ve una sección cada vez;
 * el enlace con #seccion abre esa directamente.
 */
export function TournamentTabs({
  tabs,
  registerTab,
  registerLabel,
}: {
  tabs: TournamentTab[];
  // Pestaña del formulario; si existe, se muestra el botón grande.
  registerTab: string | null;
  registerLabel: string;
}) {
  const [active, setActive] = useState(tabs[0]?.id ?? "");
  const bar = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fromHash = () => {
      const id = window.location.hash.slice(1);
      if (tabs.some((t) => t.id === id)) setActive(id);
    };
    fromHash();
    window.addEventListener("hashchange", fromHash);
    return () => window.removeEventListener("hashchange", fromHash);
  }, [tabs]);

  function open(id: string) {
    setActive(id);
    history.replaceState(null, "", `#${id}`);
    bar.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const current = tabs.find((t) => t.id === active) ?? tabs[0];
  return (
    <div className="space-y-4">
      {registerTab && active !== registerTab && (
        <button
          type="button"
          onClick={() => open(registerTab)}
          className="inline-flex h-12 w-full items-center justify-center rounded-full bg-[#d6f04a] px-6 text-base font-bold text-black shadow-sm"
        >
          {registerLabel}
        </button>
      )}
      <div
        ref={bar}
        className="sticky top-0 z-10 -mx-4 scroll-mt-2 bg-background/95 px-4 py-2 backdrop-blur"
      >
        <nav
          className="flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Secciones del torneo"
        >
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={t.id === current?.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => open(t.id)}
              className={cn(
                "inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm font-bold transition",
                t.id === current?.id
                  ? "bg-[#050505] text-white dark:bg-[#d6f04a] dark:text-black"
                  : "bg-foreground/5 text-foreground/75 hover:bg-foreground/10"
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>
      {current && (
        <div
          role="tabpanel"
          id={`panel-${current.id}`}
          aria-labelledby={`tab-${current.id}`}
        >
          {current.content}
        </div>
      )}
    </div>
  );
}
