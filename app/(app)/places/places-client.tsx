"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock3,
  Info,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Place = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  totalSessions: number;
  upcomingSessions: number;
  totalMinutes: number;
  lastScheduledAt: string | null;
};

type PlacePayload = Partial<Place> & {
  id: string;
  name: string;
  description?: string | null;
};

interface PlacesClientProps {
  initialPlaces: Place[];
}

type EditState =
  | { mode: "idle" }
  | { mode: "create" }
  | { mode: "edit"; placeId: string };

function normalizePlace(place: PlacePayload, fallback?: Place): Place {
  const now = new Date().toISOString();
  return {
    id: place.id,
    name: place.name,
    description: place.description ?? null,
    createdAt: stringOrNull(place.createdAt) ?? fallback?.createdAt ?? now,
    updatedAt: stringOrNull(place.updatedAt) ?? fallback?.updatedAt ?? now,
    totalSessions: Number(place.totalSessions ?? fallback?.totalSessions ?? 0),
    upcomingSessions: Number(
      place.upcomingSessions ?? fallback?.upcomingSessions ?? 0
    ),
    totalMinutes: Number(place.totalMinutes ?? fallback?.totalMinutes ?? 0),
    lastScheduledAt:
      stringOrNull(place.lastScheduledAt) ?? fallback?.lastScheduledAt ?? null,
  };
}

function stringOrNull(value: unknown) {
  if (value === null || value === undefined) return null;
  return String(value);
}

function formatDate(
  value: string | null,
  options?: Intl.DateTimeFormatOptions
) {
  if (!value) return "Sin datos";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin datos";
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...options,
  }).format(date);
}

function formatHours(minutes: number) {
  if (!minutes) return "0 h";
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

function usageLabel(place: Place) {
  if (place.upcomingSessions > 0) return "Con agenda";
  if (place.totalSessions > 0) return "Histórico";
  return "Sin uso";
}

function usageTone(place: Place) {
  if (place.upcomingSessions > 0) return "bg-brand text-brand-foreground";
  if (place.totalSessions > 0) return "bg-foreground/8 text-foreground/70";
  return "bg-muted text-muted-foreground";
}

export function PlacesClient({ initialPlaces }: PlacesClientProps) {
  const router = useRouter();
  const [places, setPlaces] = useState<Place[]>(
    initialPlaces.map((place) => normalizePlace(place))
  );
  const [edit, setEdit] = useState<EditState>({ mode: "idle" });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const editing =
    edit.mode === "edit" ? places.find((p) => p.id === edit.placeId) : null;

  const totals = useMemo(() => {
    return places.reduce(
      (acc, place) => ({
        sessions: acc.sessions + place.totalSessions,
        upcoming: acc.upcoming + place.upcomingSessions,
        minutes: acc.minutes + place.totalMinutes,
        withNotes: acc.withNotes + (place.description ? 1 : 0),
      }),
      { sessions: 0, upcoming: 0, minutes: 0, withNotes: 0 }
    );
  }, [places]);

  const filteredPlaces = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return places;
    return places.filter((place) =>
      [place.name, place.description ?? ""].some((value) =>
        value.toLowerCase().includes(term)
      )
    );
  }, [places, query]);

  const selected = places.find((place) => place.id === selectedId) ?? null;

  async function handleSave(formData: FormData) {
    setError(null);
    setSaving(true);
    const name = String(formData.get("name") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    if (!name) {
      setError("El nombre es obligatorio.");
      setSaving(false);
      return;
    }

    const payload = { name, description: description || null };

    try {
      if (edit.mode === "create") {
        const res = await fetch("/api/places", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "No se pudo crear el lugar.");
          return;
        }
        const { data } = await res.json();
        const created = normalizePlace(data);
        setPlaces((prev) =>
          [...prev, created].sort((a, b) => a.name.localeCompare(b.name))
        );
        setSelectedId(created.id);
        setEdit({ mode: "idle" });
        startTransition(() => router.refresh());
        return;
      }

      if (edit.mode === "edit") {
        const res = await fetch(`/api/places/${edit.placeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setError(data.error ?? "No se pudo actualizar el lugar.");
          return;
        }
        const { data } = await res.json();
        setPlaces((prev) =>
          prev
            .map((place) =>
              place.id === data.id ? normalizePlace(data, place) : place
            )
            .sort((a, b) => a.name.localeCompare(b.name))
        );
        setSelectedId(data.id);
        setEdit({ mode: "idle" });
        startTransition(() => router.refresh());
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(place: Place) {
    if (
      !confirm(
        `Borrar "${place.name}"? Las sesiones que lo usen quedarán sin lugar asignado.`
      )
    ) {
      return;
    }
    setDeletingId(place.id);
    setError(null);
    try {
      const res = await fetch(`/api/places/${place.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "No se pudo borrar el lugar.");
        return;
      }
      setPlaces((prev) => prev.filter((p) => p.id !== place.id));
      if (selectedId === place.id) setSelectedId(null);
      if (edit.mode === "edit" && edit.placeId === place.id) {
        setEdit({ mode: "idle" });
      }
      startTransition(() => router.refresh());
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="tp-hero-panel overflow-hidden p-6 text-white sm:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex rounded-full bg-[#D6FF38] px-3 py-1 text-[11px] font-black uppercase text-[#050505]">
              Operativa
            </div>
            <h1 className="text-4xl font-black leading-tight sm:text-5xl">
              Lugares
            </h1>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-6 text-white/62">
              Gestiona pistas, canchas, salas y espacios de apoyo con contexto
              suficiente para planificar sin perder tiempo.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[560px]">
            {[
              { label: "Lugares", value: places.length, icon: MapPin },
              { label: "Con notas", value: totals.withNotes, icon: Info },
              { label: "Próximas", value: totals.upcoming, icon: CalendarDays },
              {
                label: "Uso total",
                value: formatHours(totals.minutes),
                icon: Clock3,
              },
            ].map(({ label, value, icon: Icon }) => (
              <div
                key={label}
                className="rounded-[22px] border border-white/12 bg-white/8 p-3 backdrop-blur-sm"
              >
                <div className="flex items-center justify-between gap-2 text-white/52">
                  <span className="text-[10px] font-black uppercase">
                    {label}
                  </span>
                  <Icon className="size-3.5" />
                </div>
                <p className="mt-3 text-2xl font-black leading-none text-[#D6FF38]">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <section className="grid gap-4">
        <div className="space-y-4">
          <div className="tp-panel flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-foreground/35" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar por nombre, notas, material o acceso..."
                className="tp-field h-11 w-full rounded-full pl-9 pr-4 text-[13px] font-medium placeholder:text-foreground/35"
              />
            </div>
            {edit.mode === "idle" && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setEdit({ mode: "create" });
                }}
                className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-brand px-4 text-[13px] font-black text-brand-foreground transition-colors hover:bg-brand/90"
              >
                <Plus className="size-4" />
                Nuevo lugar
              </button>
            )}
          </div>

          {edit.mode !== "idle" && (
            <form
              key={edit.mode === "edit" ? edit.placeId : "create"}
              action={handleSave}
              className="tp-panel space-y-5 p-5 sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[11px] font-black uppercase text-brand">
                    {edit.mode === "create" ? "Alta de espacio" : "Edición"}
                  </p>
                  <h2 className="mt-1 text-2xl font-black text-foreground">
                    {edit.mode === "create" ? "Nuevo lugar" : "Editar lugar"}
                  </h2>
                  <p className="mt-1 max-w-2xl text-sm font-medium text-foreground/58">
                    Usa la descripción como ficha operativa: superficie,
                    material disponible, acceso, iluminación o restricciones.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setEdit({ mode: "idle" });
                    setError(null);
                  }}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-foreground/15 text-muted-foreground transition-colors hover:border-brand hover:bg-brand hover:text-brand-foreground"
                  aria-label="Cancelar"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)]">
                <div className="space-y-1.5">
                  <label
                    htmlFor="name"
                    className="block text-[12px] font-black uppercase text-foreground/58"
                  >
                    Nombre visible
                  </label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    required
                    maxLength={120}
                    defaultValue={editing?.name ?? ""}
                    placeholder="Ej: Pista central"
                    className="tp-field h-11 w-full px-4 text-sm font-medium placeholder:text-muted-foreground"
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="description"
                    className="block text-[12px] font-black uppercase text-foreground/58"
                  >
                    Ficha operativa
                  </label>
                  <textarea
                    id="description"
                    name="description"
                    rows={5}
                    maxLength={2000}
                    defaultValue={editing?.description ?? ""}
                    placeholder={
                      "Superficie: dura / tierra / indoor\nMaterial: cesta, conos, dianas\nAcceso: llave en recepcion\nNotas: buena para puntos, poca sombra a mediodia"
                    }
                    className="tp-field w-full resize-none px-3 py-2.5 text-sm leading-6 placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-[22px] border border-destructive/20 bg-destructive/10 px-4 py-3">
                  <p className="text-sm text-destructive">{error}</p>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 border-t border-foreground/10 pt-4">
                <button
                  type="submit"
                  disabled={saving || isPending}
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-black text-brand-foreground transition-all duration-150 hover:bg-brand/90 active:scale-95 disabled:opacity-60"
                >
                  {(saving || isPending) && (
                    <Loader2 className="size-4 animate-spin" />
                  )}
                  {edit.mode === "create" ? "Crear lugar" : "Guardar cambios"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEdit({ mode: "idle" });
                    setError(null);
                  }}
                  className="rounded-full px-3 py-2.5 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {places.length === 0 && edit.mode === "idle" ? (
            <div className="tp-panel px-6 py-16 text-center">
              <div className="mx-auto grid size-14 place-items-center rounded-full bg-brand/12 text-brand">
                <MapPin className="size-6" />
              </div>
              <p className="mt-5 text-lg font-black text-foreground">
                Aún no has creado ningún lugar
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm font-medium text-foreground/58">
                Crea las pistas, canchas o salas que usas para que aparezcan en
                la planificación de sesiones.
              </p>
              <button
                type="button"
                onClick={() => setEdit({ mode: "create" })}
                className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-brand px-5 text-sm font-black text-brand-foreground"
              >
                <Plus className="size-4" />
                Crear primer lugar
              </button>
            </div>
          ) : filteredPlaces.length === 0 ? (
            <div className="tp-panel px-6 py-12 text-center">
              <p className="text-sm font-black text-foreground">
                No hay resultados
              </p>
              <p className="mt-1 text-sm text-foreground/55">
                Prueba con otro nombre, material o palabra de la descripción.
              </p>
            </div>
          ) : (
            <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {filteredPlaces.map((place) => {
                const isSelected = selected?.id === place.id;
                return (
                  <li key={place.id}>
                    <article
                      className={cn(
                        "group flex h-full w-full flex-col rounded-[28px] border bg-card p-5 text-left shadow-[0_14px_45px_color-mix(in_oklab,var(--foreground)_4%,transparent)] transition duration-200 hover:-translate-y-0.5 hover:border-brand/60 dark:shadow-none",
                        isSelected
                          ? "border-brand/70 ring-2 ring-brand/18"
                          : "border-foreground/10"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span
                            className={cn(
                              "inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase",
                              usageTone(place)
                            )}
                          >
                            {usageLabel(place)}
                          </span>
                          <h3 className="mt-3 line-clamp-2 text-2xl font-black leading-none text-foreground">
                            {place.name}
                          </h3>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setError(null);
                              setEdit({ mode: "edit", placeId: place.id });
                            }}
                            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label={`Editar ${place.name}`}
                          >
                            <Pencil className="size-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDelete(place);
                            }}
                            className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`Borrar ${place.name}`}
                          >
                            {deletingId === place.id ? (
                              <Loader2 className="size-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="size-3.5" />
                            )}
                          </button>
                        </div>
                      </div>

                      <p className="mt-4 line-clamp-3 min-h-[4.5rem] text-sm font-medium leading-6 text-foreground/60">
                        {place.description ||
                          "Sin ficha operativa. Añade superficie, material, acceso o notas para que el equipo lo use con criterio."}
                      </p>

                      <dl className="mt-5 grid grid-cols-3 gap-2 border-t border-foreground/10 pt-4">
                        <div>
                          <dt className="text-[10px] font-black uppercase text-foreground/38">
                            Sesiones
                          </dt>
                          <dd className="mt-1 text-lg font-black tabular-nums text-foreground">
                            {place.totalSessions}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-black uppercase text-foreground/38">
                            Prox.
                          </dt>
                          <dd className="mt-1 text-lg font-black tabular-nums text-brand">
                            {place.upcomingSessions}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-[10px] font-black uppercase text-foreground/38">
                            Carga
                          </dt>
                          <dd className="mt-1 truncate text-lg font-black tabular-nums text-foreground">
                            {formatHours(place.totalMinutes)}
                          </dd>
                        </div>
                      </dl>
                      <button
                        type="button"
                        onClick={() => setSelectedId(place.id)}
                        className={cn(
                          "mt-5 inline-flex h-10 w-full items-center justify-center rounded-full border text-[13px] font-black transition-colors",
                          isSelected
                            ? "border-brand bg-brand text-brand-foreground"
                            : "border-foreground/10 text-foreground/62 hover:border-brand/50 hover:text-brand"
                        )}
                      >
                        {isSelected ? "Detalle abierto" : "Ver detalle"}
                      </button>
                    </article>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </section>

      {selected && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="place-detail-title"
          className="fixed inset-0 z-[70] flex items-end justify-end bg-[#050505]/48 px-3 py-3 backdrop-blur-sm sm:px-5 sm:py-5"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedId(null);
          }}
        >
          <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[460px] flex-col overflow-hidden rounded-[32px] border border-foreground/10 bg-card shadow-[0_30px_100px_rgba(5,5,5,0.34)] sm:max-h-[calc(100dvh-2.5rem)]">
            <div className="border-b border-foreground/10 bg-foreground px-5 py-5 text-background">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase text-brand">
                    Detalle del lugar
                  </p>
                  <h2
                    id="place-detail-title"
                    className="mt-2 line-clamp-2 text-2xl font-black leading-none"
                  >
                    {selected.name}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedId(null)}
                  className="flex size-9 shrink-0 items-center justify-center rounded-full border border-background/15 text-background/70 transition-colors hover:bg-background/10 hover:text-background"
                  aria-label="Cerrar detalle"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    label: "Sesiones",
                    value: selected.totalSessions,
                    icon: ClipboardList,
                  },
                  {
                    label: "Próximas",
                    value: selected.upcomingSessions,
                    icon: CalendarDays,
                  },
                  {
                    label: "Carga",
                    value: formatHours(selected.totalMinutes),
                    icon: Clock3,
                  },
                  {
                    label: "Estado",
                    value: usageLabel(selected),
                    icon: CheckCircle2,
                  },
                ].map(({ label, value, icon: Icon }) => (
                  <div
                    key={label}
                    className="rounded-[20px] border border-foreground/10 bg-background p-3"
                  >
                    <div className="flex items-center justify-between gap-2 text-foreground/42">
                      <span className="text-[10px] font-black uppercase">
                        {label}
                      </span>
                      <Icon className="size-3.5" />
                    </div>
                    <p className="mt-2 text-lg font-black leading-none text-foreground">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div>
                <h3 className="text-[12px] font-black uppercase text-foreground/48">
                  Ficha operativa
                </h3>
                <p className="mt-2 whitespace-pre-line rounded-[22px] border border-foreground/10 bg-background px-4 py-3 text-sm font-medium leading-6 text-foreground/68">
                  {selected.description ||
                    "Sin notas. Puedes usar este campo para superficie, material, acceso, iluminación, restricciones y contexto de uso."}
                </p>
              </div>

              <dl className="divide-y divide-foreground/10 rounded-[22px] border border-foreground/10 px-4">
                {[
                  {
                    label: "Última sesión",
                    value: formatDate(selected.lastScheduledAt),
                  },
                  {
                    label: "Creado",
                    value: formatDate(selected.createdAt),
                  },
                  {
                    label: "Actualizado",
                    value: formatDate(selected.updatedAt, {
                      hour: "2-digit",
                      minute: "2-digit",
                    }),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="grid grid-cols-[112px_1fr] gap-3 py-3 text-sm"
                  >
                    <dt className="font-bold text-foreground/48">
                      {item.label}
                    </dt>
                    <dd className="text-right font-semibold text-foreground">
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-foreground/10 bg-card p-5">
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setEdit({ mode: "edit", placeId: selected.id });
                  setSelectedId(null);
                }}
                className="inline-flex h-10 items-center gap-2 rounded-full bg-brand px-4 text-[13px] font-black text-brand-foreground"
              >
                <Pencil className="size-3.5" />
                Editar
              </button>
              <button
                type="button"
                onClick={() => handleDelete(selected)}
                className="inline-flex h-10 items-center gap-2 rounded-full border border-destructive/30 px-4 text-[13px] font-black text-destructive transition-colors hover:bg-destructive/10"
              >
                {deletingId === selected.id ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Trash2 className="size-3.5" />
                )}
                Borrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
