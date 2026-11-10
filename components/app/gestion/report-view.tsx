import type { ReportBlockId, ReportMetricId } from "@/lib/club-report/catalog";
import type { MetricView, ViewPart } from "@/lib/club-report/views";
import { cn } from "@/lib/utils";

// Datos del informe de gestión en pantalla, por bloques. Pinta las mismas
// vistas que el PDF (lib/club-report/views.ts).

function Part({ part }: { part: ViewPart }) {
  switch (part.kind) {
    case "stats":
      return (
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {part.items.map((item) => (
            <div key={item.label}>
              <dt className="text-[11px] font-black uppercase text-foreground/55">
                {item.label}
              </dt>
              <dd className="font-heading text-2xl font-black tabular-nums text-foreground">
                {item.value}
              </dd>
              {item.hint && (
                <dd className="text-xs text-muted-foreground">{item.hint}</dd>
              )}
            </div>
          ))}
        </dl>
      );
    case "bars": {
      if (part.rows.length === 0) return null;
      const max = Math.max(...part.rows.map((r) => r.value), 0) || 1;
      return (
        <div>
          {part.title && (
            <p className="mb-1.5 text-[11px] font-black uppercase text-foreground/55">
              {part.title}
            </p>
          )}
          <ul className="space-y-1.5">
            {part.rows.map((r, i) => (
              <li
                key={`${r.label}-${i}`}
                className="flex items-center gap-2 text-sm"
              >
                <span
                  className="w-36 shrink-0 truncate text-foreground/80"
                  title={r.label}
                >
                  {r.label}
                </span>
                <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{
                      width: `${Math.max((r.value / max) * 100, r.value > 0 ? 2 : 0)}%`,
                    }}
                  />
                </span>
                <span className="w-28 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                  {r.display}
                </span>
              </li>
            ))}
          </ul>
        </div>
      );
    }
    case "table":
      return (
        <div>
          {part.title && (
            <p className="mb-1.5 text-[11px] font-black uppercase text-foreground/55">
              {part.title}
            </p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-black uppercase text-foreground/55">
                  {part.columns.map((c) => (
                    <th
                      key={c.label}
                      className={cn(
                        "py-2 pr-3 last:pr-0",
                        c.align === "right" && "text-right"
                      )}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {part.rows.map((row, ri) => (
                  <tr
                    key={ri}
                    className="border-b border-border/60 last:border-0"
                  >
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className={cn(
                          "py-2 pr-3 last:pr-0",
                          ci === 0
                            ? "font-semibold text-foreground"
                            : "text-foreground/80",
                          part.columns[ci]?.align === "right" &&
                            "text-right tabular-nums"
                        )}
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    case "note":
      return <p className="text-xs text-muted-foreground">{part.text}</p>;
  }
}

function hasContent(view: MetricView) {
  return view.parts.some(
    (p) =>
      (p.kind === "bars" && p.rows.length > 0) ||
      (p.kind === "table" && p.rows.length > 0) ||
      p.kind === "stats" ||
      p.kind === "note"
  );
}

/** Ancho completo para las tablas grandes; el resto, en dos columnas. */
const WIDE: ReadonlySet<string> = new Set([
  "alumnos_altas",
  "alumnos_bajas",
  "alumnos_tabla",
  "grupos_actividad",
  "monitores_actividad",
  "monitores_ejercicios",
  "monitores_cambios",
]);

export function ReportView({
  blocks,
  views,
}: {
  blocks: {
    id: ReportBlockId;
    label: string;
    metrics: { id: ReportMetricId }[];
  }[];
  views: Map<ReportMetricId, MetricView>;
}) {
  return (
    <div className="space-y-8">
      {blocks.length > 1 && (
        <nav aria-label="Bloques" className="flex flex-wrap gap-2 text-sm">
          {blocks.map((b) => (
            <a
              key={b.id}
              href={`#bloque-${b.id}`}
              className="rounded-full border border-border px-3 py-1.5 font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {b.label}
            </a>
          ))}
        </nav>
      )}
      {blocks.map((block) => (
        <section
          key={block.id}
          id={`bloque-${block.id}`}
          className="scroll-mt-24"
        >
          <h2 className="mb-3 border-b-2 border-[#D6FF38] pb-1 font-heading text-2xl font-black text-foreground">
            {block.label}
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {block.metrics.map((m) => {
              const view = views.get(m.id);
              if (!view) return null;
              return (
                <article
                  key={m.id}
                  className={cn(
                    "rounded-lg border border-border bg-card p-5 shadow-sm",
                    WIDE.has(m.id) && "lg:col-span-2"
                  )}
                >
                  <h3 className="text-base font-black text-foreground">
                    {view.title}
                  </h3>
                  {view.hint && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {view.hint}
                    </p>
                  )}
                  <div className="mt-3 space-y-4">
                    {hasContent(view) ? (
                      view.parts.map((part, i) => <Part key={i} part={part} />)
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        {view.empty ?? "Sin datos."}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
