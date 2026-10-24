"use client";

import { useMemo, useState } from "react";
import { Check, ListChecks, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ASPECTS,
  BALLS,
  type AspectId,
  type BallId,
} from "@/lib/objectives-taxonomy";
import { textHasObjective } from "@/lib/objectives-text";
import { objectiveToInfinitive } from "@/lib/objectives-infinitive";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type CatalogObjective = {
  id: string;
  code: string;
  ball: BallId;
  aspect: AspectId;
  block: string;
  title: string;
  criterion: string | null;
  scope: "base" | "club" | "coach" | "student";
};

type Catalog = {
  scope: "club" | "coach" | "base";
  items: CatalogObjective[];
};

// Se pide al abrir el selector por primera vez; depende del modo de trabajo,
// así que no se comparte entre páginas.
async function fetchCatalog(): Promise<Catalog> {
  const res = await fetch("/api/objectives/catalog", { cache: "no-store" });
  if (!res.ok) throw new Error("catalog");
  const json = (await res.json()) as { data: Catalog };
  return json.data;
}

const ASPECT_LABEL = Object.fromEntries(
  ASPECTS.map((a) => [a.id, a.label])
) as Record<AspectId, string>;

function chipClass(active: boolean) {
  return cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] font-black uppercase transition-colors",
    active
      ? "border-brand bg-brand/15 text-brand"
      : "border-border bg-background text-foreground/60 hover:border-brand/40"
  );
}

function normalize(s: string) {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Botón "Cargar objetivos": abre el catálogo de Objetivos (el del club con el
 * que se trabaja o el propio del monitor) para elegir varios y añadirlos al
 * campo de objetivos. El campo sigue siendo libre: se puede escribir antes o
 * después.
 */
export function ObjectivesPicker({
  onAdd,
  currentText,
  defaultBall,
  label = "Cargar objetivos",
  className,
  infinitive = false,
}: {
  onAdd: (titles: string[]) => void;
  /**
   * En ejercicios, clases y sesiones los objetivos se escriben en infinitivo
   * ("Golpear…"); en el catálogo y en grupos se quedan en presente ("Golpea…").
   */
  infinitive?: boolean;
  /** Texto actual del campo, para marcar los objetivos que ya están. */
  currentText?: string | null;
  defaultBall?: BallId | null;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ball, setBall] = useState<BallId>(defaultBall ?? "roja");
  const [aspect, setAspect] = useState<AspectId | "todos">("todos");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Map<string, string>>(new Map());

  function openPicker() {
    setSelected(new Map());
    setQuery("");
    setError(null);
    setOpen(true);
    if (!catalog) {
      setLoading(true);
      fetchCatalog()
        .then(setCatalog)
        .catch(() => setError("No se pudieron cargar los objetivos."))
        .finally(() => setLoading(false));
    }
  }

  const items = useMemo(() => catalog?.items ?? [], [catalog]);
  const q = normalize(query.trim());

  const groups = useMemo(() => {
    const list = items.filter(
      (i) =>
        (q
          ? normalize(`${i.title} ${i.block} ${i.criterion ?? ""}`).includes(q)
          : i.ball === ball) &&
        (aspect === "todos" || i.aspect === aspect)
    );
    const map = new Map<string, CatalogObjective[]>();
    for (const i of list) {
      const key = `${i.ball}|${i.aspect}|${i.block}`;
      map.set(key, [...(map.get(key) ?? []), i]);
    }
    return Array.from(map, ([key, rows]) => ({
      key,
      ball: rows[0].ball,
      aspect: rows[0].aspect,
      block: rows[0].block,
      rows,
    }));
  }, [items, q, ball, aspect]);

  function toggle(item: CatalogObjective) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) next.delete(item.id);
      else next.set(item.id, item.title);
      return next;
    });
  }

  function confirm() {
    // En el orden del catálogo, no en el de los clics.
    const order = new Map(items.map((i, idx) => [i.id, idx]));
    const titles = [...selected.entries()]
      .sort((a, b) => (order.get(a[0]) ?? 0) - (order.get(b[0]) ?? 0))
      .map(([, title]) => (infinitive ? objectiveToInfinitive(title) : title));
    if (titles.length) onAdd(titles);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={openPicker}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-brand/40 bg-brand/10 px-3 py-1.5 text-xs font-bold text-brand transition-colors hover:bg-brand/20",
          className
        )}
      >
        <ListChecks className="size-3.5" />
        {label}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Cargar objetivos</DialogTitle>
            <DialogDescription>
              {catalog?.scope === "club"
                ? "Objetivos de tu club. Marca los que quieras añadir; después puedes editarlos o escribir otros."
                : catalog?.scope === "base"
                  ? "Objetivos de Ten Planner. Marca los que quieras añadir; después puedes editarlos o escribir otros."
                  : "Tus objetivos (los de Ten Planner con tus cambios). Marca los que quieras añadir; después puedes editarlos o escribir otros."}
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en todas las bolas…"
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-2 focus:ring-brand/40"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {!q &&
              BALLS.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBall(b.id)}
                  className={chipClass(ball === b.id)}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: b.color }}
                  />
                  {b.chip}
                </button>
              ))}
            <span className="mx-1 hidden h-6 w-px self-center bg-border sm:block" />
            {(["todos", ...ASPECTS.map((a) => a.id)] as const).map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => setAspect(a)}
                className={chipClass(aspect === a)}
              >
                {a === "todos" ? "Todos" : ASPECT_LABEL[a]}
              </button>
            ))}
          </div>

          <div className="-mx-1 min-h-40 flex-1 overflow-y-auto px-1">
            {loading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 className="size-5 animate-spin" />
              </div>
            ) : error ? (
              <p className="py-8 text-center text-sm text-destructive">
                {error}
              </p>
            ) : groups.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No hay objetivos con estos filtros.
              </p>
            ) : (
              <div className="space-y-4">
                {groups.map((g) => (
                  <div key={g.key}>
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-black uppercase text-foreground/50">
                      {q && (
                        <span
                          className="size-2 rounded-full"
                          style={{
                            backgroundColor: BALLS.find((b) => b.id === g.ball)
                              ?.color,
                          }}
                        />
                      )}
                      {ASPECT_LABEL[g.aspect]} · {g.block}
                    </p>
                    <ul className="divide-y divide-border rounded-xl border border-border">
                      {g.rows.map((item) => {
                        const already =
                          textHasObjective(currentText, item.title) ||
                          (infinitive &&
                            textHasObjective(
                              currentText,
                              objectiveToInfinitive(item.title)
                            ));
                        const checked = selected.has(item.id);
                        return (
                          <li key={item.id}>
                            <button
                              type="button"
                              disabled={already}
                              onClick={() => toggle(item)}
                              className={cn(
                                "flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors",
                                already
                                  ? "cursor-default opacity-50"
                                  : "hover:bg-brand/5",
                                checked && "bg-brand/10"
                              )}
                            >
                              <span
                                className={cn(
                                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border",
                                  checked || already
                                    ? "border-brand bg-brand text-[#050505]"
                                    : "border-foreground/30"
                                )}
                              >
                                {(checked || already) && (
                                  <Check className="size-3" strokeWidth={3} />
                                )}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-semibold leading-snug text-foreground">
                                  {item.title}
                                </span>
                                {item.criterion && (
                                  <span className="mt-0.5 block text-xs leading-snug text-muted-foreground">
                                    {item.criterion}
                                  </span>
                                )}
                              </span>
                              {already ? (
                                <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">
                                  Ya añadido
                                </span>
                              ) : item.scope !== "base" ? (
                                <span className="shrink-0 text-[10px] font-bold uppercase text-brand">
                                  {item.scope === "club" ? "Del club" : "Tuyo"}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <p className="text-xs text-muted-foreground">
              {selected.size === 0
                ? "Ninguno seleccionado"
                : `${selected.size} seleccionado${selected.size === 1 ? "" : "s"}`}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-border px-4 py-2 text-sm font-bold text-foreground/70 transition-colors hover:bg-muted"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirm}
                disabled={selected.size === 0}
                className="rounded-full bg-[#D6FF38] px-4 py-2 text-sm font-black text-[#050505] transition-colors hover:bg-[#c8ef2f] disabled:opacity-50"
              >
                Añadir
                {selected.size > 0 ? ` (${selected.size})` : ""}
              </button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
