import Link from "next/link";
import { eq, or, desc, and, ilike, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { db } from "@/db";
import { classes, classFavorites, users } from "@/db/schema";
import { Plus, Search, FileText } from "lucide-react";
import {
  classNavQueryString,
  classOrderBy,
  CLASS_SORTS,
  parseClassSort,
  type ClassSort,
} from "@/lib/nav/class-nav";
import { nivelesForSport } from "@/lib/exercise-taxonomy";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { spaceLabels } from "@/lib/space-labels";
import { getActiveSport } from "@/lib/sports";
import { getPublicSportCookie } from "@/lib/public-sport";
import { SportGate } from "@/components/public/sport-gate";
import { SportChangePill } from "@/components/public/sport-change-pill";
import { ClassListsSection } from "@/components/app/class-lists-section";
import { PublicClassListsSection } from "@/components/app/public-class-lists-section";
import { getSpaceLabel, isUserAdmin } from "@/lib/classes/lists";
import { ClassesGrid } from "./classes-grid";

const TABS = ["all", "library", "mine", "favorites", "drafts"] as const;
type Tab = (typeof TABS)[number];

// "Mis clases"/"Mis listas" pasan a "Clases club"/"Listas club" trabajando
// como un club (ver lib/space-labels.ts).
function tabLabelsFor(inClub: boolean): Record<Tab, string> {
  const labels = spaceLabels(inClub);
  return {
    all: "Ver todas",
    library: "Biblioteca",
    mine: labels.classes,
    favorites: labels.lists,
    drafts: "Borradores",
  };
}

function nivelFiltersForSport(sport?: string | null) {
  return [
    { id: "", label: "Todos" },
    ...nivelesForSport(sport).map((n) => ({
      id: n.id,
      label: n.edad ? `${n.label} (${n.edad.replace(" años", "")})` : n.label,
    })),
  ];
}

const DURACION_FILTERS = [
  { id: "", label: "Cualquiera" },
  { id: "30", label: "30 min" },
  { id: "45", label: "45 min" },
  { id: "60", label: "60 min" },
  { id: "75", label: "75 min" },
  { id: "90", label: "90 min" },
  { id: "120", label: "+90 min" },
];

const ASPECTO_FILTERS = [
  { id: "tecnica", label: "Técnica" },
  { id: "tactica", label: "Táctica" },
  { id: "mental", label: "Mental / cognitivo" },
  { id: "fisico", label: "Físico / movilidad" },
];

const GOLPES_FILTERS = [
  { id: "derecha", label: "Derecha" },
  { id: "reves", label: "Revés" },
  { id: "saque", label: "Saque" },
  { id: "volea", label: "Volea" },
  { id: "remate", label: "Remate" },
  { id: "dejada", label: "Dejada" },
  { id: "globo", label: "Globo" },
];

const SORT_LABELS: Record<ClassSort, string> = {
  alpha: "Alfabético",
  popular: "Más populares",
  recent: "Más recientes",
  oldest: "Más antiguos",
};

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function paramList(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value.map((v) => v.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

export default async function ClassesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const user = session?.user ?? null;

  const sport = user
    ? await getActiveSport(user.id)
    : await getPublicSportCookie();

  if (!sport) {
    return <SportGate />;
  }

  const requestedTab = (params.tab as string) ?? "all";
  const tab: Tab = TABS.includes(requestedTab as Tab)
    ? (requestedTab as Tab)
    : "all";
  const activeTab: Tab =
    !user && (tab === "mine" || tab === "favorites") ? "all" : tab;

  // Cabecera de "Mis listas": en qué espacio se está (particular o club) y
  // si el usuario es admin (puede publicar listas en la Biblioteca).
  const listsMeta =
    activeTab === "favorites" && user
      ? await Promise.all([
          isUserAdmin(user.id),
          getActiveWorkClubId(user.id),
        ]).then(async ([isAdmin, clubId]) => ({
          isAdmin,
          inClub: !!clubId,
          spaceLabel: await getSpaceLabel(clubId),
        }))
      : null;

  const q = typeof params.q === "string" ? params.q.trim() : "";
  const nivel = typeof params.nivel === "string" ? params.nivel : "";
  const duracion = typeof params.duracion === "string" ? params.duracion : "";
  const aspectoList = paramList(params.aspecto);
  const golpeList = paramList(params.golpe);
  const activeSort = parseClassSort(params);

  // For drafts tab we don't query classes
  let rows: Array<{
    id: string;
    name: string;
    duracionMinutes: number;
    alumnosTipo: string | null;
    numAlumnos: number | null;
    objetivos: string | null;
    nivel: string | null;
    niveles: string[] | null;
    aspectoJuego: string | null;
    aspectosJuego: string[] | null;
    isLibrary: boolean;
    autoria: string | null;
    status: string | null;
    createdAt: Date;
    createdBy: string | null;
    authorName: string | null;
  }> = [];
  let draftCount = 0;
  let draftRows: Array<{
    id: string;
    name: string;
    updatedAt: Date;
  }> = [];

  if (user) {
    // Borradores: clases propias aún sin publicar (status = "draft").
    draftRows = await db
      .select({
        id: classes.id,
        name: classes.name,
        updatedAt: classes.updatedAt,
      })
      .from(classes)
      .where(
        and(
          eq(classes.createdBy, user.id),
          eq(classes.status, "draft"),
          eq(classes.sport, sport)
        )
      )
      .orderBy(desc(classes.updatedAt))
      .limit(50);
    draftCount = draftRows.length;
  }

  const activeClubId = user ? await getActiveWorkClubId(user.id) : null;
  const TAB_LABELS = tabLabelsFor(!!activeClubId);
  const mineOrClub = user
    ? sharedWithClubCondition(
        classes.createdBy,
        classes.clubId,
        user.id,
        activeClubId
      )
    : null;

  if (activeTab !== "drafts") {
    const conds = [eq(classes.sport, sport)];
    if (activeTab === "mine" && user) {
      // "Mis clases" también incluye los borradores propios: si no, una
      // clase recién creada como borrador (p. ej. al pulsar Enter, que por
      // seguridad guarda como borrador) desaparece sin dejar rastro y el
      // monitor termina editando por error otra clase distinta.
      conds.push(
        or(
          and(eq(classes.status, "published"), mineOrClub!),
          and(eq(classes.createdBy, user.id), eq(classes.status, "draft"))
        )!
      );
    } else {
      conds.push(eq(classes.status, "published"));
      if (activeTab === "library") {
        conds.push(eq(classes.isLibrary, true));
      } else if (activeTab === "favorites" && user) {
        conds.push(
          sql`${classes.id} IN (SELECT class_id FROM class_favorites WHERE user_id = ${user.id})`
        );
      } else {
        conds.push(
          user
            ? or(eq(classes.isLibrary, true), mineOrClub!)!
            : eq(classes.isLibrary, true)
        );
      }
    }
    if (q) conds.push(ilike(classes.name, `%${q}%`));
    if (nivel) {
      conds.push(
        or(
          sql`${classes.niveles} @> ${JSON.stringify([nivel])}::jsonb`,
          eq(classes.nivel, nivel)
        )!
      );
    }
    if (aspectoList.length > 0) {
      // Coincide si la clase tiene AL MENOS UNO de los aspectos seleccionados.
      conds.push(
        or(
          ...aspectoList.map(
            (a) =>
              or(
                sql`${classes.aspectosJuego} @> ${JSON.stringify([a])}::jsonb`,
                eq(classes.aspectoJuego, a)
              )!
          )
        )!
      );
    }
    if (duracion === "120") {
      conds.push(sql`${classes.duracionMinutes} > 90`);
    } else if (duracion) {
      const d = Number(duracion);
      if (Number.isFinite(d)) conds.push(eq(classes.duracionMinutes, d));
    }
    if (golpeList.length > 0) {
      // Coincide si la clase tiene AL MENOS UNO de los golpes seleccionados.
      conds.push(
        or(
          ...golpeList.map(
            (g) => sql`${classes.golpes}::jsonb @> ${`["${g}"]`}::jsonb`
          )
        )!
      );
    }

    const rawRows = await db
      .select({
        id: classes.id,
        name: classes.name,
        duracionMinutes: classes.duracionMinutes,
        alumnosTipo: classes.alumnosTipo,
        numAlumnos: classes.numAlumnos,
        objetivos: classes.objetivos,
        nivel: classes.nivel,
        niveles: classes.niveles,
        aspectoJuego: classes.aspectoJuego,
        aspectosJuego: classes.aspectosJuego,
        isLibrary: classes.isLibrary,
        autoria: classes.autoria,
        status: classes.status,
        createdAt: classes.createdAt,
        createdBy: classes.createdBy,
        authorName: users.name,
      })
      .from(classes)
      .leftJoin(users, eq(users.id, classes.createdBy))
      .where(and(...conds))
      .orderBy(...classOrderBy(activeSort))
      .limit(60);
    rows = rawRows.map((r) => ({
      ...r,
      authorName: user && r.createdBy !== user.id ? r.authorName : null,
    }));
  }

  // Favorites set para pintar el corazón si aplica
  const favRows = user
    ? await db
        .select({ classId: classFavorites.classId })
        .from(classFavorites)
        .where(eq(classFavorites.userId, user.id))
    : [];
  const favorites = new Set(favRows.map((f) => f.classId));
  const navQs = classNavQueryString(params);

  function buildSortHref(sort: ClassSort) {
    const sp = new URLSearchParams();
    if (tab !== "all") sp.set("tab", tab);
    if (q) sp.set("q", q);
    if (nivel) sp.set("nivel", nivel);
    if (duracion) sp.set("duracion", duracion);
    aspectoList.forEach((a) => sp.append("aspecto", a));
    golpeList.forEach((g) => sp.append("golpe", g));
    if (sort !== "alpha") sp.set("sort", sort);
    return sp.toString() ? `/classes?${sp.toString()}` : "/classes";
  }

  return (
    <div className="relative min-h-full overflow-hidden bg-[#F4F4F1] px-4 py-6 text-[#050505] dark:bg-[#050505] dark:text-[#F4F4F1] sm:px-6 md:px-10 lg:px-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_78%_18%,rgba(214,255,56,0.24),transparent_34%),linear-gradient(180deg,rgba(5,5,5,0.06),transparent)] dark:bg-[radial-gradient(circle_at_78%_18%,rgba(214,255,56,0.18),transparent_34%)]" />
      <div className="relative space-y-6">
        <header className="overflow-hidden rounded-lg bg-[#050505] text-white shadow-[0_24px_80px_rgba(5,5,5,0.18)]">
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:p-8">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-[#D6FF38]">
                  Biblioteca de clases
                </p>
                {!user && <SportChangePill sport={sport} />}
              </div>
              <h1 className="mt-3 font-heading text-4xl font-semibold leading-none tracking-normal text-white sm:text-5xl">
                Clases
              </h1>
              <p className="mt-4 max-w-2xl text-[14px] leading-relaxed text-white/68">
                Plantillas reutilizables con bloques y ejercicios para preparar
                sesiones completas sin perder criterio en pista o cancha.
              </p>
            </div>
            <div className="flex flex-col items-start gap-3 lg:items-end lg:justify-between">
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2">
                  <p className="font-heading text-2xl leading-none text-[#D6FF38]">
                    {rows.length}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/45">
                    visibles
                  </p>
                </div>
                <div className="rounded-lg border border-white/12 bg-white/[0.04] px-3 py-2">
                  <p className="font-heading text-2xl leading-none text-white">
                    {draftCount}
                  </p>
                  <p className="mt-1 text-[9px] uppercase tracking-[0.18em] text-white/45">
                    borradores
                  </p>
                </div>
              </div>
              {user && (
                <Link
                  href="/classes/new"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#D6FF38] px-5 text-[13px] font-black text-[#050505] transition hover:bg-white"
                >
                  <Plus className="size-4" />
                  Nueva clase
                </Link>
              )}
            </div>
          </div>
          <div className="h-2 bg-[#D6FF38]" />
        </header>

        {/* Tabs */}
        <nav className="flex gap-2 overflow-x-auto rounded-lg border border-[#050505]/10 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/[0.04]">
          {TABS.map((t) => {
            if (!user && (t === "mine" || t === "favorites" || t === "drafts"))
              return null;
            const active = activeTab === t;
            const sp = new URLSearchParams();
            if (t !== "all") sp.set("tab", t);
            if (q) sp.set("q", q);
            if (nivel) sp.set("nivel", nivel);
            if (duracion) sp.set("duracion", duracion);
            aspectoList.forEach((a) => sp.append("aspecto", a));
            golpeList.forEach((g) => sp.append("golpe", g));
            if (activeSort !== "alpha") sp.set("sort", activeSort);
            return (
              <Link
                key={t}
                href={sp.toString() ? `/classes?${sp.toString()}` : "/classes"}
                className={`inline-flex min-h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
                  active
                    ? "bg-[#D6FF38] text-[#050505]"
                    : "text-muted-foreground hover:bg-[#050505]/5 hover:text-foreground dark:hover:bg-white/8"
                }`}
              >
                {TAB_LABELS[t]}
                {t === "drafts" && draftCount > 0 && (
                  <span className="ml-1.5 text-[10px] tabular-nums opacity-60">
                    ({draftCount})
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {activeTab === "drafts" && user ? (
          draftRows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-[#050505]/18 bg-white/60 px-6 py-20 text-center dark:border-white/15 dark:bg-white/[0.04]">
              <div className="flex size-14 items-center justify-center rounded-lg border border-[#D6FF38]/40 bg-[#D6FF38]/20">
                <FileText className="size-6 text-[#6D7F00] dark:text-[#D6FF38]" />
              </div>
              <div>
                <p className="text-base font-semibold text-foreground/40">
                  Sin borradores
                </p>
                <p className="text-sm text-foreground/30 mt-1">
                  Las clases que guardes como borrador aparecerán aquí.
                </p>
              </div>
              <Link
                href="/classes/new"
                className="mt-1 inline-flex items-center gap-2 rounded-full bg-[#050505] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#D6FF38] hover:text-[#050505] dark:bg-[#D6FF38] dark:text-[#050505]"
              >
                Crear clase
              </Link>
            </div>
          ) : (
            <ul className="space-y-2">
              {draftRows.map((draft, i) => {
                const name = draft.name.trim() || "Clase sin título";
                return (
                  <li
                    key={draft.id}
                    className="flex items-center gap-3 rounded-lg border border-[#050505]/10 bg-white/70 px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    <span className="font-sans text-[9px] tabular-nums text-foreground/30 shrink-0">
                      {(i + 1).toString().padStart(2, "0")}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] font-heading text-foreground truncate">
                        {name}
                      </p>
                      <p className="text-[11px] text-foreground/45 mt-0.5 tabular-nums">
                        {new Intl.DateTimeFormat("es-ES", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }).format(new Date(draft.updatedAt))}
                      </p>
                    </div>
                    <Link
                      href={`/classes/${draft.id}/edit`}
                      className="inline-flex items-center gap-1 rounded-full bg-[#D6FF38] px-3 py-1.5 text-[12px] font-semibold text-[#050505] transition hover:bg-[#050505] hover:text-white dark:hover:bg-white"
                    >
                      Continuar
                    </Link>
                  </li>
                );
              })}
            </ul>
          )
        ) : activeTab === "favorites" && user ? (
          <ClassListsSection
            isAdmin={listsMeta?.isAdmin ?? false}
            spaceLabel={listsMeta?.spaceLabel ?? null}
            inClub={listsMeta?.inClub ?? false}
          />
        ) : (
          <>
            {activeTab === "library" && (
              <PublicClassListsSection
                sport={sport}
                loggedIn={!!user}
                inClub={!!activeClubId}
              />
            )}
            {/* Filtros: search + nivel + duración + aspecto + golpe */}
            <form
              className="grid gap-3 rounded-lg border border-[#050505]/10 bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/[0.04] md:grid-cols-[minmax(220px,1fr)_repeat(4,auto)_auto] md:items-end"
              action="/classes"
            >
              {tab !== "all" && <input type="hidden" name="tab" value={tab} />}
              {activeSort !== "alpha" && (
                <input type="hidden" name="sort" value={activeSort} />
              )}
              <div className="flex-1 min-w-[200px]">
                <label
                  htmlFor="q"
                  className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5"
                >
                  Buscar
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/60" />
                  <input
                    id="q"
                    name="q"
                    defaultValue={q}
                    placeholder="Nombre, contenido, objetivos…"
                    className="h-11 w-full rounded-full border border-[#050505]/12 bg-[#F4F4F1] pl-9 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-[#D6FF38] focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/40 dark:border-white/10 dark:bg-[#050505]"
                  />
                </div>
              </div>
              <div>
                <label
                  htmlFor="nivel"
                  className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5"
                >
                  Nivel
                </label>
                <select
                  id="nivel"
                  name="nivel"
                  defaultValue={nivel}
                  className="h-11 rounded-full border border-[#050505]/12 bg-[#F4F4F1] px-3 text-sm text-foreground focus:border-[#D6FF38] focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/40 dark:border-white/10 dark:bg-[#050505]"
                >
                  {nivelFiltersForSport(sport).map((n) => (
                    <option key={n.id} value={n.id}>
                      {n.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="duracion"
                  className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5"
                >
                  Duración
                </label>
                <select
                  id="duracion"
                  name="duracion"
                  defaultValue={duracion}
                  className="h-11 rounded-full border border-[#050505]/12 bg-[#F4F4F1] px-3 text-sm text-foreground focus:border-[#D6FF38] focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/40 dark:border-white/10 dark:bg-[#050505]"
                >
                  {DURACION_FILTERS.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Aspecto{" "}
                  <span className="normal-case tracking-normal text-muted-foreground/70">
                    (varios)
                  </span>
                </label>
                <details className="relative">
                  <summary className="flex h-11 w-full min-w-[9rem] cursor-pointer list-none items-center justify-between gap-2 rounded-full border border-[#050505]/12 bg-[#F4F4F1] px-4 text-sm text-foreground focus:border-[#D6FF38] focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/40 dark:border-white/10 dark:bg-[#050505]">
                    {aspectoList.length > 0
                      ? ASPECTO_FILTERS.filter((a) =>
                          aspectoList.includes(a.id)
                        )
                          .map((a) => a.label)
                          .join(", ")
                      : "Cualquiera"}
                  </summary>
                  <div className="absolute z-10 mt-2 w-56 space-y-1 rounded-lg border border-[#050505]/12 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-[#0a0a0a]">
                    {ASPECTO_FILTERS.map((a) => (
                      <label
                        key={a.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-[#D6FF38]/10"
                      >
                        <input
                          type="checkbox"
                          name="aspecto"
                          value={a.id}
                          defaultChecked={aspectoList.includes(a.id)}
                          className="size-4 rounded border-foreground/20 text-[#D6FF38] focus:ring-[#D6FF38]/30"
                        />
                        {a.label}
                      </label>
                    ))}
                  </div>
                </details>
              </div>
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-foreground mb-1.5">
                  Golpe{" "}
                  <span className="normal-case tracking-normal text-muted-foreground/70">
                    (varios)
                  </span>
                </label>
                <details className="relative">
                  <summary className="flex h-11 w-full min-w-[9rem] cursor-pointer list-none items-center justify-between gap-2 rounded-full border border-[#050505]/12 bg-[#F4F4F1] px-4 text-sm text-foreground focus:border-[#D6FF38] focus:outline-none focus:ring-2 focus:ring-[#D6FF38]/40 dark:border-white/10 dark:bg-[#050505]">
                    {golpeList.length > 0
                      ? GOLPES_FILTERS.filter((g) => golpeList.includes(g.id))
                          .map((g) => g.label)
                          .join(", ")
                      : "Cualquiera"}
                  </summary>
                  <div className="absolute z-10 mt-2 w-56 space-y-1 rounded-lg border border-[#050505]/12 bg-white p-2 shadow-lg dark:border-white/10 dark:bg-[#0a0a0a]">
                    {GOLPES_FILTERS.map((g) => (
                      <label
                        key={g.id}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-foreground hover:bg-[#D6FF38]/10"
                      >
                        <input
                          type="checkbox"
                          name="golpe"
                          value={g.id}
                          defaultChecked={golpeList.includes(g.id)}
                          className="size-4 rounded border-foreground/20 text-[#D6FF38] focus:ring-[#D6FF38]/30"
                        />
                        {g.label}
                      </label>
                    ))}
                  </div>
                </details>
              </div>
              <button
                type="submit"
                className="h-11 rounded-full bg-[#050505] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#D6FF38] hover:text-[#050505] dark:bg-[#D6FF38] dark:text-[#050505] dark:hover:bg-white"
              >
                Filtrar
              </button>
            </form>

            {/* Orden */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="shrink-0 px-1 font-sans text-[10px] uppercase tracking-[0.2em] text-foreground/40">
                Ordenar por:
              </span>
              {CLASS_SORTS.map((s) => {
                const isActive = activeSort === s;
                return (
                  <Link
                    key={s}
                    href={buildSortHref(s)}
                    className={`whitespace-nowrap rounded-full border px-3 py-2 text-[11px] font-sans font-semibold tracking-[0.08em] transition-colors ${
                      isActive
                        ? "border-[#D6FF38] bg-[#D6FF38] text-[#050505]"
                        : "border-foreground/15 text-foreground/55 hover:border-foreground/30 hover:text-foreground"
                    }`}
                  >
                    {SORT_LABELS[s]}
                  </Link>
                );
              })}
            </div>

            {/* Listado */}
            {rows.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#050505]/18 bg-white/60 px-6 py-16 text-center dark:border-white/15 dark:bg-white/[0.04]">
                <p className="text-[15px] font-medium text-foreground mb-2">
                  No hay clases que coincidan
                </p>
                <p className="text-[13px] text-foreground/55 max-w-md mx-auto">
                  Prueba a quitar algún filtro o crea una clase nueva.
                </p>
                {user && (
                  <Link
                    href="/classes/new"
                    className="mt-5 inline-flex items-center gap-1.5 rounded-full bg-[#050505] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#D6FF38] hover:text-[#050505] dark:bg-[#D6FF38] dark:text-[#050505]"
                  >
                    <Plus className="size-3.5" />
                    Crear la primera
                  </Link>
                )}
              </div>
            ) : (
              <ClassesGrid
                items={rows.map((cls) => ({
                  ...cls,
                  favorited: favorites.has(cls.id),
                }))}
                navQs={navQs}
                canSelect={!!user}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
