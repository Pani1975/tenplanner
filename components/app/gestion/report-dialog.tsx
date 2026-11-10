"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Eye,
  FileDown,
  LayoutTemplate,
  Loader2,
  Pencil,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface DialogBlock {
  id: string;
  label: string;
  metrics: { id: string; label: string }[];
}

export interface DialogTemplate {
  id: string;
  name: string;
  metrics: string[];
}

type PeriodKey = "30" | "90" | "365" | "personalizado";

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: "30", label: "30 días" },
  { key: "90", label: "3 meses" },
  { key: "365", label: "12 meses" },
  { key: "personalizado", label: "Personalizado" },
];

/**
 * Botón verde "Generar informe". Abre un panel con dos pestañas:
 * - "Nuevo informe": se eligen periodo y datos (por bloques) y se descarga
 *   el PDF; opcionalmente se guarda el diseño como plantilla.
 * - "Plantillas": diseños guardados; se generan con el periodo elegido, se
 *   ven en pantalla, se editan o se borran.
 */
export function ReportDialog({
  blocks,
  templates: initialTemplates,
  templatesAvailable,
  initialPeriod,
  initialFrom,
  initialTo,
  today,
}: {
  blocks: DialogBlock[];
  templates: DialogTemplate[];
  /** false si la tabla de plantillas aún no existe (migración pendiente). */
  templatesAvailable: boolean;
  initialPeriod: PeriodKey;
  initialFrom: string;
  initialTo: string;
  today: string;
}) {
  const router = useRouter();
  const allIds = useMemo(
    () => blocks.flatMap((b) => b.metrics.map((m) => m.id)),
    [blocks]
  );
  const labelById = useMemo(
    () => new Map(blocks.flatMap((b) => b.metrics.map((m) => [m.id, m.label]))),
    [blocks]
  );

  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"nuevo" | "plantillas">("nuevo");
  const [period, setPeriod] = useState<PeriodKey>(initialPeriod);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allIds));
  const [templates, setTemplates] = useState(initialTemplates);
  const [editing, setEditing] = useState<DialogTemplate | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function periodQuery() {
    const q = new URLSearchParams();
    if (period === "personalizado") {
      q.set("periodo", "personalizado");
      q.set("desde", from);
      q.set("hasta", to);
    } else if (period !== "30") {
      q.set("periodo", period);
    }
    return q;
  }

  const periodInvalid =
    period === "personalizado" && (!from || !to || from > to);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleBlock(block: DialogBlock) {
    setSelected((prev) => {
      const next = new Set(prev);
      const all = block.metrics.every((m) => next.has(m.id));
      for (const m of block.metrics) {
        if (all) next.delete(m.id);
        else next.add(m.id);
      }
      return next;
    });
  }

  async function download(
    target: { metrics: string[] } | { templateId: string },
    key: string
  ) {
    setBusy(key);
    setError(null);
    setMessage(null);
    try {
      const q = periodQuery();
      if ("templateId" in target) q.set("plantilla", target.templateId);
      else q.set("metricas", target.metrics.join(","));
      const res = await fetch(`/api/gestion/informe/pdf?${q.toString()}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo generar el informe");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const match = (res.headers.get("Content-Disposition") ?? "").match(
        /filename="([^"]+)"/
      );
      a.download = match?.[1] ?? "informe-gestion.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(null);
    }
  }

  async function saveTemplate(asNew: boolean) {
    const metrics = allIds.filter((id) => selected.has(id));
    setBusy("save");
    setError(null);
    setMessage(null);
    try {
      const updating = editing && !asNew;
      const res = await fetch(
        updating
          ? `/api/gestion/plantillas/${editing.id}`
          : "/api/gestion/plantillas",
        {
          method: updating ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), metrics }),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.error ?? "No se pudo guardar la plantilla");
      const saved = data.data as DialogTemplate;
      setTemplates((prev) =>
        [...prev.filter((t) => t.id !== saved.id), saved].sort((a, b) =>
          a.name.localeCompare(b.name)
        )
      );
      setEditing(saved);
      setMessage(updating ? "Plantilla actualizada." : "Plantilla guardada.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(null);
    }
  }

  async function removeTemplate(t: DialogTemplate) {
    if (!window.confirm(`¿Borrar la plantilla «${t.name}»?`)) return;
    setBusy(`del-${t.id}`);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch(`/api/gestion/plantillas/${t.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo borrar la plantilla");
      }
      setTemplates((prev) => prev.filter((x) => x.id !== t.id));
      if (editing?.id === t.id) {
        setEditing(null);
        setName("");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(null);
    }
  }

  function editTemplate(t: DialogTemplate) {
    setEditing(t);
    setName(t.name);
    setSelected(new Set(t.metrics));
    setTab("nuevo");
    setError(null);
    setMessage(null);
  }

  function startNew() {
    setEditing(null);
    setName("");
    setSelected(new Set(allIds));
    setMessage(null);
    setError(null);
  }

  function viewOnScreen(templateId: string | null) {
    const q = periodQuery();
    if (templateId) q.set("plantilla", templateId);
    setOpen(false);
    router.push(`/gestion${q.size ? `?${q.toString()}` : ""}`);
  }

  const selectedList = allIds.filter((id) => selected.has(id));
  const inputClass =
    "h-10 rounded-lg border border-border bg-background px-3 text-sm text-foreground";

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setMessage(null);
          setOpen(true);
        }}
        className="inline-flex h-11 items-center gap-2 rounded-full bg-[#D6FF38] px-5 text-sm font-black text-[#050505] shadow-sm transition-transform hover:scale-[1.02]"
      >
        <FileDown className="size-4" />
        Generar informe
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !busy && setOpen(false)}
          />
          <div
            role="dialog"
            aria-label="Generar informe"
            className="relative flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-[28px] border border-[#050505]/10 bg-white p-5 shadow-2xl dark:border-white/10 dark:bg-[#10100e]"
          >
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-base font-black text-foreground">
                Generar informe
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="ml-auto flex size-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Periodo: común a las dos pestañas */}
            <div className="mb-3 flex flex-wrap items-end gap-2 text-sm">
              <span className="w-full text-[11px] font-black uppercase text-foreground/55">
                Periodo
              </span>
              {PERIOD_OPTIONS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 font-semibold transition-colors",
                    period === p.key
                      ? "border-brand bg-brand/10 text-foreground"
                      : "border-border text-muted-foreground hover:bg-muted"
                  )}
                >
                  {p.label}
                </button>
              ))}
              {period === "personalizado" && (
                <div className="flex w-full flex-wrap gap-2 pt-1">
                  <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                    Desde
                    <input
                      type="date"
                      value={from}
                      max={today}
                      onChange={(e) => setFrom(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
                    Hasta
                    <input
                      type="date"
                      value={to}
                      max={today}
                      onChange={(e) => setTo(e.target.value)}
                      className={inputClass}
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="mb-3 flex gap-1 rounded-full bg-muted p-1 text-sm font-semibold">
              {(
                [
                  [
                    "nuevo",
                    editing ? `Editar «${editing.name}»` : "Nuevo informe",
                  ],
                  ["plantillas", `Plantillas (${templates.length})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTab(key)}
                  className={cn(
                    "flex-1 truncate rounded-full px-3 py-1.5 transition-colors",
                    tab === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === "nuevo" ? (
              <>
                <div className="mb-2 flex flex-wrap gap-3 text-xs font-semibold">
                  <button
                    type="button"
                    className="text-brand"
                    onClick={() => setSelected(new Set(allIds))}
                  >
                    Seleccionar todo
                  </button>
                  <button
                    type="button"
                    className="text-muted-foreground"
                    onClick={() => setSelected(new Set())}
                  >
                    Quitar todo
                  </button>
                  {editing && (
                    <button
                      type="button"
                      className="ml-auto text-muted-foreground"
                      onClick={startNew}
                    >
                      Empezar un informe nuevo
                    </button>
                  )}
                </div>
                <div className="-mx-1 flex-1 space-y-3 overflow-y-auto px-1">
                  {blocks.map((block) => {
                    const count = block.metrics.filter((m) =>
                      selected.has(m.id)
                    ).length;
                    return (
                      <fieldset
                        key={block.id}
                        className="rounded-lg border border-border p-3"
                      >
                        <legend className="px-1">
                          <label className="flex cursor-pointer items-center gap-2 text-sm font-black text-foreground">
                            <input
                              type="checkbox"
                              checked={count === block.metrics.length}
                              ref={(el) => {
                                if (el)
                                  el.indeterminate =
                                    count > 0 && count < block.metrics.length;
                              }}
                              onChange={() => toggleBlock(block)}
                              className="size-4 accent-[#6D7F00]"
                            />
                            {block.label}
                            <span className="font-normal text-muted-foreground">
                              {count}/{block.metrics.length}
                            </span>
                          </label>
                        </legend>
                        <ul className="grid gap-0.5 sm:grid-cols-2">
                          {block.metrics.map((m) => (
                            <li key={m.id}>
                              <label className="flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted">
                                <input
                                  type="checkbox"
                                  checked={selected.has(m.id)}
                                  onChange={() => toggle(m.id)}
                                  className="mt-0.5 size-4 shrink-0 accent-[#6D7F00]"
                                />
                                <span className="text-foreground/90">
                                  {m.label}
                                </span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      </fieldset>
                    );
                  })}
                </div>

                <div className="mt-3 space-y-3 border-t border-border pt-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => download({ metrics: selectedList }, "pdf")}
                      disabled={
                        !!busy || selectedList.length === 0 || periodInvalid
                      }
                      className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-full bg-[#D6FF38] px-5 text-sm font-black text-[#050505] disabled:opacity-50"
                    >
                      {busy === "pdf" ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : (
                        <FileDown className="size-4" />
                      )}
                      Descargar PDF ({selectedList.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => viewOnScreen(null)}
                      disabled={periodInvalid}
                      className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-4 text-sm font-semibold text-foreground disabled:opacity-50"
                      title="Ver todos los datos en la página con este periodo"
                    >
                      <Eye className="size-4" />
                      Ver todo en pantalla
                    </button>
                  </div>

                  {templatesAvailable ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="text"
                        value={name}
                        maxLength={120}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Nombre de la plantilla (p. ej. Altas y bajas)"
                        className={cn(inputClass, "min-w-0 flex-1")}
                      />
                      <button
                        type="button"
                        onClick={() => saveTemplate(false)}
                        disabled={
                          !!busy || !name.trim() || selectedList.length === 0
                        }
                        className="inline-flex h-10 items-center gap-2 rounded-full bg-foreground px-4 text-sm font-black text-background disabled:opacity-50"
                      >
                        {busy === "save" ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Save className="size-4" />
                        )}
                        {editing ? "Guardar cambios" : "Guardar como plantilla"}
                      </button>
                      {editing && (
                        <button
                          type="button"
                          onClick={() => saveTemplate(true)}
                          disabled={
                            !!busy || !name.trim() || selectedList.length === 0
                          }
                          className="h-10 rounded-full border border-border px-4 text-sm font-semibold text-foreground disabled:opacity-50"
                        >
                          Guardar como nueva
                        </button>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Las plantillas aún no están disponibles: falta aplicar la
                      migración de la base de datos.
                    </p>
                  )}
                </div>
              </>
            ) : (
              <div className="-mx-1 flex-1 overflow-y-auto px-1">
                {templates.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    <LayoutTemplate className="mx-auto mb-2 size-6 opacity-50" />
                    Aún no hay plantillas. Elige los datos en «Nuevo informe» y
                    guárdalos como plantilla para generarlos rápidamente.
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {templates.map((t) => (
                      <li
                        key={t.id}
                        className="rounded-lg border border-border p-3"
                      >
                        <div className="flex flex-wrap items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-black text-foreground">
                              {t.name}
                            </p>
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                              {t.metrics.length} datos ·{" "}
                              {t.metrics
                                .map((id) => labelById.get(id))
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                download({ templateId: t.id }, `pdf-${t.id}`)
                              }
                              disabled={!!busy || periodInvalid}
                              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[#D6FF38] px-3 text-xs font-black text-[#050505] disabled:opacity-50"
                            >
                              {busy === `pdf-${t.id}` ? (
                                <Loader2 className="size-3.5 animate-spin" />
                              ) : (
                                <FileDown className="size-3.5" />
                              )}
                              PDF
                            </button>
                            <button
                              type="button"
                              onClick={() => viewOnScreen(t.id)}
                              disabled={periodInvalid}
                              aria-label={`Ver «${t.name}» en pantalla`}
                              title="Ver en pantalla"
                              className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted disabled:opacity-50"
                            >
                              <Eye className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => editTemplate(t)}
                              aria-label={`Editar «${t.name}»`}
                              title="Editar"
                              className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted"
                            >
                              <Pencil className="size-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeTemplate(t)}
                              disabled={!!busy}
                              aria-label={`Borrar «${t.name}»`}
                              title="Borrar"
                              className="flex size-9 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                              {busy === `del-${t.id}` ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <Trash2 className="size-4" />
                              )}
                            </button>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {periodInvalid && (
              <p className="mt-2 text-xs text-red-500">
                Revisa las fechas del periodo personalizado.
              </p>
            )}
            {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
            {message && (
              <p className="mt-2 text-xs font-semibold text-[#6D7F00]">
                {message}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
