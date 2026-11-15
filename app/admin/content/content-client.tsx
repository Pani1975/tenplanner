"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Trash2,
  Search,
  Globe,
  Lock,
  Loader2,
  ExternalLink,
  Filter,
  CheckSquare,
  Square,
  Bot,
  Clock,
  BarChart2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  adminActionClass,
  adminInputClass,
  adminPrimaryActionClass,
  adminTableShellClass,
} from "../_components/admin-ui";
import { ExercisePublishToggle } from "@/components/app/exercise-publish-toggle";

interface Exercise {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  isGlobal: boolean;
  isPublished: boolean;
  isAiGenerated: boolean;
  createdAt: string;
  createdByEmail: string | null;
  createdByName: string | null;
  usageCount: number;
}

interface Session {
  id: string;
  title: string;
  status: string;
  scheduledAt: string;
  durationMinutes: number | null;
  createdAt: string;
  userEmail: string | null;
  userName: string | null;
  exerciseCount: number;
}

type ExFilter =
  | "all"
  | "global"
  | "private"
  | "ai"
  | "published"
  | "unpublished";

interface Props {
  exercises: Exercise[];
  exerciseTotal: number;
  exercisePage: number;
  exerciseTotalPages: number;
  sessions: Session[];
  sessionTotal: number;
  sessionPage: number;
  sessionTotalPages: number;
  q: string;
  exFilter: ExFilter;
  tab: string;
}

const DIFF_LABEL: Record<string, string> = {
  beginner: "Inicio",
  intermediate: "Medio",
  advanced: "Avanzado",
};
const CAT_LABEL: Record<string, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Físico",
  "warm-up": "Calentamiento",
};
const CAT_COLOR: Record<string, string> = {
  technique: "text-blue-400 border-blue-400/30 bg-blue-400/8",
  tactics: "text-purple-400 border-purple-400/30 bg-purple-400/8",
  fitness: "text-amber-400 border-amber-400/30 bg-amber-400/8",
  "warm-up": "text-brand border-brand/30 bg-brand/8",
};
const STATUS_LABEL: Record<string, string> = {
  scheduled: "Programada",
  completed: "Completada",
  cancelled: "Cancelada",
  draft: "Borrador",
};

function buildHref(opts: {
  q?: string;
  exFilter?: string;
  exPage?: number;
  sPage?: number;
  tab?: string;
}) {
  const p = new URLSearchParams();
  if (opts.q) p.set("q", opts.q);
  if (opts.tab && opts.tab !== "exercises") p.set("tab", opts.tab);
  if (opts.exFilter && opts.exFilter !== "all")
    p.set("exFilter", opts.exFilter);
  if (opts.exPage && opts.exPage > 1) p.set("exPage", String(opts.exPage));
  if (opts.sPage && opts.sPage > 1) p.set("sPage", String(opts.sPage));
  const qs = p.toString();
  return `/admin/content${qs ? `?${qs}` : ""}`;
}

function PaginationBar({
  page,
  totalPages,
  href,
}: {
  page: number;
  totalPages: number;
  href: (p: number) => string;
}) {
  if (totalPages <= 1) return null;
  return (
    <footer className="flex items-center justify-between pt-1">
      <p className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/45 tabular-nums">
        Pág. {page} / {totalPages}
      </p>
      <div className="flex items-center gap-4">
        {page > 1 ? (
          <Link
            href={href(page - 1)}
            className="inline-flex items-center gap-1.5 text-[12px] text-foreground/70 hover:text-brand transition-colors"
          >
            <ArrowLeft className="size-3" /> Anterior
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground/25">
            <ArrowLeft className="size-3" /> Anterior
          </span>
        )}
        {page < totalPages ? (
          <Link
            href={href(page + 1)}
            className="inline-flex items-center gap-1.5 text-[12px] text-foreground/70 hover:text-brand transition-colors"
          >
            Siguiente <ArrowRight className="size-3" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-foreground/25">
            Siguiente <ArrowRight className="size-3" />
          </span>
        )}
      </div>
    </footer>
  );
}

export function AdminContentClient({
  exercises: initialExercises,
  exerciseTotal,
  exercisePage,
  exerciseTotalPages,
  sessions,
  sessionTotal,
  sessionPage,
  sessionTotalPages,
  q,
  exFilter,
  tab,
}: Props) {
  const router = useRouter();
  const [exercises, setExercises] = useState(initialExercises);
  const [busy, setBusy] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [searchDraft, setSearchDraft] = useState(q);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    router.push(
      buildHref({ q: searchDraft, exFilter, tab, exPage: 1, sPage: 1 })
    );
  }

  async function toggleGlobal(id: string, makeGlobal: boolean) {
    setBusy(id);
    try {
      const res = await fetch(`/api/exercises/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isGlobal: makeGlobal }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Error");
      }
      setExercises((prev) =>
        prev.map((e) => (e.id === id ? { ...e, isGlobal: makeGlobal } : e))
      );
      setSelected((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      toast.success(
        makeGlobal ? "Publicado globalmente" : "Marcado como privado"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar");
    } finally {
      setBusy(null);
    }
  }

  async function bulkToggleGlobal(makeGlobal: boolean) {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy("bulk");
    let ok = 0;
    for (const id of ids) {
      try {
        const res = await fetch(`/api/exercises/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isGlobal: makeGlobal }),
        });
        if (res.ok) {
          setExercises((prev) =>
            prev.map((e) => (e.id === id ? { ...e, isGlobal: makeGlobal } : e))
          );
          ok++;
        }
      } catch {
        /* continue */
      }
    }
    setSelected(new Set());
    setBusy(null);
    toast.success(
      `${ok} ejercicio${ok !== 1 ? "s" : ""} ${makeGlobal ? "publicados" : "marcados privados"}`
    );
  }

  async function deleteExercise(id: string) {
    setBusy(id);
    try {
      const res = await fetch(`/api/exercises/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setExercises((prev) => prev.filter((e) => e.id !== id));
      setSelected((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      toast.success("Ejercicio eliminado");
    } catch {
      toast.error("Error al eliminar");
    } finally {
      setBusy(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function toggleSelectAll() {
    if (selected.size === exercises.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(exercises.map((e) => e.id)));
    }
  }

  const allSelected =
    exercises.length > 0 && selected.size === exercises.length;

  const exFilterOptions: [ExFilter, string][] = [
    ["all", `Todos (${exerciseTotal})`],
    ["global", "Globales"],
    ["private", "Privados"],
    ["ai", "IA"],
    ["unpublished", "Sin publicar"],
    ["published", "Publicados"],
  ];

  return (
    <div className="space-y-4">
      {/* Search */}
      <form onSubmit={handleSearchSubmit} className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-foreground/40" />
        <input
          type="text"
          placeholder="Buscar por nombre o autor…"
          value={searchDraft}
          onChange={(e) => setSearchDraft(e.target.value)}
          className={cn(adminInputClass, "w-full pl-9 pr-4")}
        />
      </form>

      <Tabs
        defaultValue={tab}
        onValueChange={(t) =>
          router.push(buildHref({ q, exFilter, tab: t, exPage: 1, sPage: 1 }))
        }
      >
        <TabsList className="rounded-lg border border-foreground/12 bg-card/90">
          <TabsTrigger value="exercises">
            Ejercicios ({exerciseTotal.toLocaleString("es-ES")})
          </TabsTrigger>
          <TabsTrigger value="sessions">
            Sesiones ({sessionTotal.toLocaleString("es-ES")})
          </TabsTrigger>
        </TabsList>

        {/* ── EXERCISES ── */}
        <TabsContent value="exercises" className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <Filter className="size-3.5 text-foreground/40 shrink-0" />
              {exFilterOptions.map(([f, label]) => (
                <Link
                  key={f}
                  href={buildHref({
                    q,
                    exFilter: f,
                    tab: "exercises",
                    exPage: 1,
                    sPage: sessionPage,
                  })}
                  className={cn(
                    "px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors whitespace-nowrap",
                    exFilter === f
                      ? "bg-[#D6FF38] text-[#050505]"
                      : "bg-card text-foreground/55 ring-1 ring-foreground/10 hover:text-foreground"
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>

            {selected.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-foreground/50">
                  {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
                </span>
                <button
                  onClick={() => void bulkToggleGlobal(true)}
                  disabled={busy === "bulk"}
                  className={cn(
                    adminPrimaryActionClass,
                    "h-7 px-2.5 text-[11px]"
                  )}
                >
                  <Globe className="size-3" /> Publicar todos
                </button>
                <button
                  onClick={() => void bulkToggleGlobal(false)}
                  disabled={busy === "bulk"}
                  className={cn(adminActionClass, "h-7 px-2.5 text-[11px]")}
                >
                  <Lock className="size-3" /> Privar todos
                </button>
              </div>
            )}
          </div>

          {/* Mobile cards */}
          <div className="grid gap-3 md:hidden">
            {exercises.length === 0 && (
              <div className="rounded-lg border border-foreground/12 bg-card/80 px-4 py-10 text-center text-sm text-foreground/40">
                No hay ejercicios
              </div>
            )}
            {exercises.map((e) => (
              <article
                key={e.id}
                className={cn(
                  "rounded-lg border border-foreground/12 bg-card/90 p-4",
                  selected.has(e.id) && "border-brand/30 bg-brand/[0.03]"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    onClick={() => toggleSelect(e.id)}
                    className="mt-0.5 text-foreground/40 transition-colors hover:text-brand"
                  >
                    {selected.has(e.id) ? (
                      <CheckSquare className="size-4 text-brand" />
                    ) : (
                      <Square className="size-4" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {e.name}
                    </p>
                    <p className="mt-0.5 text-xs text-foreground/40">
                      {DIFF_LABEL[e.difficulty] ?? e.difficulty}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px] border",
                      CAT_COLOR[e.category]
                    )}
                  >
                    {CAT_LABEL[e.category] ?? e.category}
                  </Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {e.isGlobal ? (
                    <Badge className="bg-brand/10 text-brand border-brand/20 text-[10px] gap-1">
                      <Globe className="size-2.5" /> Global
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="text-[10px] gap-1 text-foreground/40"
                    >
                      <Lock className="size-2.5" /> Privado
                    </Badge>
                  )}
                  {e.isAiGenerated && (
                    <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px] gap-1">
                      <Bot className="size-2.5" /> IA
                    </Badge>
                  )}
                  <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-foreground/50">
                    <Clock className="size-2.5" /> {e.durationMinutes}min
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-foreground/50">
                    <BarChart2 className="size-2.5" /> {e.usageCount}
                  </span>
                </div>

                <div className="mt-3 min-w-0 border-t border-foreground/10 pt-3">
                  <p className="truncate text-xs text-foreground/70">
                    {e.createdByName ?? "—"}
                  </p>
                  {e.createdByEmail && (
                    <p className="truncate text-[10px] text-foreground/35">
                      {e.createdByEmail}
                    </p>
                  )}
                </div>

                {e.isGlobal && (
                  <ExercisePublishToggle
                    exerciseId={e.id}
                    initialPublished={e.isPublished}
                    className="mt-3 flex-wrap"
                  />
                )}

                <div className="mt-3 flex justify-end gap-2">
                  <Link
                    href={`/exercises/${e.id}`}
                    target="_blank"
                    className={adminActionClass}
                  >
                    <ExternalLink className="size-3.5" /> Ver
                  </Link>
                  <button
                    onClick={() => void toggleGlobal(e.id, !e.isGlobal)}
                    disabled={busy === e.id || busy === "bulk"}
                    className={cn(
                      adminPrimaryActionClass,
                      "disabled:opacity-40"
                    )}
                  >
                    {busy === e.id ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : e.isGlobal ? (
                      <Lock className="size-3.5" />
                    ) : (
                      <Globe className="size-3.5" />
                    )}
                    {e.isGlobal ? "Hacer privado" : "Hacer global"}
                  </button>
                  <button
                    onClick={() => setDeleteTarget({ id: e.id, name: e.name })}
                    disabled={busy === e.id || busy === "bulk"}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive transition-colors hover:bg-destructive/15 disabled:opacity-40"
                  >
                    <Trash2 className="size-3.5" /> Eliminar
                  </button>
                </div>
              </article>
            ))}
          </div>

          {/* Desktop table */}
          <div className={cn(adminTableShellClass, "hidden md:block")}>
            <Table>
              <TableHeader>
                <TableRow className="border-foreground/10 hover:bg-transparent">
                  <TableHead className="w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="text-foreground/40 hover:text-foreground transition-colors"
                    >
                      {allSelected ? (
                        <CheckSquare className="size-4" />
                      ) : (
                        <Square className="size-4" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-foreground/50">
                    Ejercicio
                  </TableHead>
                  <TableHead className="text-foreground/50">
                    Categoría
                  </TableHead>
                  <TableHead className="text-foreground/50">Autor</TableHead>
                  <TableHead className="text-foreground/50 text-center">
                    Uso
                  </TableHead>
                  <TableHead className="text-foreground/50 text-center">
                    Duración
                  </TableHead>
                  <TableHead className="text-foreground/50">Estado</TableHead>
                  <TableHead className="text-foreground/50">Creado</TableHead>
                  <TableHead className="text-foreground/50 text-right">
                    Acciones
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {exercises.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={9}
                      className="text-center text-foreground/40 py-10"
                    >
                      No hay ejercicios
                    </TableCell>
                  </TableRow>
                )}
                {exercises.map((e) => (
                  <TableRow
                    key={e.id}
                    className={cn(
                      "border-foreground/8 hover:bg-foreground/[0.02] transition-colors",
                      selected.has(e.id) && "bg-brand/[0.03]"
                    )}
                  >
                    <TableCell>
                      <button
                        onClick={() => toggleSelect(e.id)}
                        className="text-foreground/40 hover:text-brand transition-colors"
                      >
                        {selected.has(e.id) ? (
                          <CheckSquare className="size-4 text-brand" />
                        ) : (
                          <Square className="size-4" />
                        )}
                      </button>
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">
                        {e.name}
                      </p>
                      <p className="text-xs text-foreground/40">
                        {DIFF_LABEL[e.difficulty] ?? e.difficulty}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] border",
                          CAT_COLOR[e.category]
                        )}
                      >
                        {CAT_LABEL[e.category] ?? e.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-foreground/70">
                        {e.createdByName ?? "—"}
                      </p>
                      {e.createdByEmail && (
                        <p className="text-[10px] text-foreground/35">
                          {e.createdByEmail}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={cn(
                          "text-xs tabular-nums",
                          e.usageCount > 0
                            ? "text-foreground/70"
                            : "text-foreground/25"
                        )}
                      >
                        {e.usageCount > 0 ? (
                          <span className="flex items-center justify-center gap-1">
                            <BarChart2 className="size-3" /> {e.usageCount}
                          </span>
                        ) : (
                          "—"
                        )}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-foreground/50 tabular-nums flex items-center justify-center gap-1">
                        <Clock className="size-3" /> {e.durationMinutes}min
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-1">
                        {e.isGlobal ? (
                          <Badge className="bg-brand/10 text-brand border-brand/20 text-[10px] gap-1">
                            <Globe className="size-2.5" /> Global
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="text-[10px] gap-1 text-foreground/40"
                          >
                            <Lock className="size-2.5" /> Privado
                          </Badge>
                        )}
                        {e.isAiGenerated && (
                          <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20 text-[10px] gap-1">
                            <Bot className="size-2.5" /> IA
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-foreground/40 tabular-nums">
                      {new Date(e.createdAt).toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        {e.isGlobal && (
                          <ExercisePublishToggle
                            exerciseId={e.id}
                            initialPublished={e.isPublished}
                            compact
                          />
                        )}
                        <Link
                          href={`/exercises/${e.id}`}
                          target="_blank"
                          className="p-1.5 rounded-lg text-foreground/40 hover:text-foreground hover:bg-foreground/8 transition-colors"
                          title="Ver ejercicio"
                        >
                          <ExternalLink className="size-4" />
                        </Link>
                        <button
                          onClick={() => void toggleGlobal(e.id, !e.isGlobal)}
                          disabled={busy === e.id || busy === "bulk"}
                          title={e.isGlobal ? "Hacer privado" : "Hacer global"}
                          className={cn(
                            "p-1.5 rounded-lg transition-colors disabled:opacity-40",
                            e.isGlobal
                              ? "text-brand hover:text-foreground/60 hover:bg-foreground/8"
                              : "text-foreground/40 hover:text-brand hover:bg-brand/10"
                          )}
                        >
                          {busy === e.id ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : e.isGlobal ? (
                            <Lock className="size-4" />
                          ) : (
                            <Globe className="size-4" />
                          )}
                        </button>
                        <button
                          onClick={() =>
                            setDeleteTarget({ id: e.id, name: e.name })
                          }
                          disabled={busy === e.id || busy === "bulk"}
                          title="Eliminar ejercicio"
                          className="p-1.5 rounded-lg text-foreground/40 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-40"
                        >
                          <Trash2 className="size-4" />
                        </button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationBar
            page={exercisePage}
            totalPages={exerciseTotalPages}
            href={(p) =>
              buildHref({
                q,
                exFilter,
                tab: "exercises",
                exPage: p,
                sPage: sessionPage,
              })
            }
          />
        </TabsContent>

        {/* ── SESSIONS ── */}
        <TabsContent value="sessions" className="mt-4 space-y-3">
          <div className="grid gap-3 md:hidden">
            {sessions.length === 0 && (
              <div className="rounded-lg border border-foreground/12 bg-card/80 px-4 py-10 text-center text-sm text-foreground/40">
                No hay sesiones
              </div>
            )}
            {sessions.map((s) => (
              <article
                key={s.id}
                className="rounded-lg border border-foreground/12 bg-card/90 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {s.title}
                    </p>
                    <p className="mt-1 text-xs text-foreground/45">
                      {new Date(s.scheduledAt).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "shrink-0 text-[10px]",
                      s.status === "completed" && "text-brand border-brand/30",
                      s.status === "cancelled" &&
                        "text-red-400 border-red-400/30"
                    )}
                  >
                    {STATUS_LABEL[s.status] ?? s.status}
                  </Badge>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 border-y border-foreground/10 py-3">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/35">
                      Ejercicios
                    </p>
                    <p className="mt-1 text-sm tabular-nums text-foreground/75">
                      {s.exerciseCount > 0 ? s.exerciseCount : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-foreground/35">
                      Duración
                    </p>
                    <p className="mt-1 text-sm tabular-nums text-foreground/75">
                      {s.durationMinutes ? `${s.durationMinutes}min` : "—"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 min-w-0">
                  <p className="truncate text-xs text-foreground/70">
                    {s.userName ?? "—"}
                  </p>
                  {s.userEmail && (
                    <p className="truncate text-[10px] text-foreground/35">
                      {s.userEmail}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>

          <div className={cn(adminTableShellClass, "hidden md:block")}>
            <Table>
              <TableHeader>
                <TableRow className="border-foreground/10 hover:bg-transparent">
                  <TableHead className="text-foreground/50">Sesión</TableHead>
                  <TableHead className="text-foreground/50">Estado</TableHead>
                  <TableHead className="text-foreground/50">
                    Entrenador
                  </TableHead>
                  <TableHead className="text-foreground/50 text-center">
                    Ejercicios
                  </TableHead>
                  <TableHead className="text-foreground/50 text-center">
                    Duración
                  </TableHead>
                  <TableHead className="text-foreground/50">
                    Fecha sesión
                  </TableHead>
                  <TableHead className="text-foreground/50">Creada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="text-center text-foreground/40 py-10"
                    >
                      No hay sesiones
                    </TableCell>
                  </TableRow>
                )}
                {sessions.map((s) => (
                  <TableRow
                    key={s.id}
                    className="border-foreground/8 hover:bg-foreground/[0.02]"
                  >
                    <TableCell>
                      <p className="text-sm font-medium text-foreground">
                        {s.title}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px]",
                          s.status === "completed" &&
                            "text-brand border-brand/30",
                          s.status === "cancelled" &&
                            "text-red-400 border-red-400/30"
                        )}
                      >
                        {STATUS_LABEL[s.status] ?? s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-foreground/70">
                        {s.userName ?? "—"}
                      </p>
                      {s.userEmail && (
                        <p className="text-[10px] text-foreground/35">
                          {s.userEmail}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-center text-xs text-foreground/50 tabular-nums">
                      {s.exerciseCount > 0 ? s.exerciseCount : "—"}
                    </TableCell>
                    <TableCell className="text-center text-xs text-foreground/50 tabular-nums">
                      {s.durationMinutes ? `${s.durationMinutes}min` : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-foreground/40 tabular-nums">
                      {new Date(s.scheduledAt).toLocaleDateString("es-ES")}
                    </TableCell>
                    <TableCell className="text-xs text-foreground/40 tabular-nums">
                      {new Date(s.createdAt).toLocaleDateString("es-ES")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <PaginationBar
            page={sessionPage}
            totalPages={sessionTotalPages}
            href={(p) =>
              buildHref({
                q,
                exFilter,
                tab: "sessions",
                exPage: exercisePage,
                sPage: p,
              })
            }
          />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        title={`¿Eliminar "${deleteTarget?.name}"?`}
        description="Esta acción es irreversible y no se puede deshacer."
        confirmLabel="Eliminar"
        destructive
        onConfirm={() => {
          if (deleteTarget) void deleteExercise(deleteTarget.id);
        }}
      />
    </div>
  );
}
