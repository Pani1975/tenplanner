"use client";

import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ExerciseDiagramView } from "@/components/app/exercise-diagram";
import type { Diagram } from "@/lib/exercise-diagrams/types";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  X,
  Loader2,
  Clock,
  Target,
  Brain,
  Dumbbell,
  Flame,
  Video,
  Lightbulb,
  Package,
  ListOrdered,
  ExternalLink,
  BookMarked,
  Shuffle,
  StickyNote,
  Lock,
  ShieldAlert,
  FileDown,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { ExerciseForm } from "@/components/app/exercise-form";
import { ExerciseRating } from "@/components/app/exercise-rating";
import { ExerciseListPicker } from "@/components/app/exercise-list-picker";
import { AddToClassButton } from "@/components/app/add-to-class-dialog";
import {
  ASPECTO_JUEGO_LABELS,
  autoriaLabel,
  caracterLabel,
  nivelLabel,
  pelotaLabel,
  situacionJuegoLabel,
  type TipoPelota,
  TIPO_ACTIVIDAD_LABELS,
} from "@/lib/exercise-taxonomy";
import { getYouTubeEmbedUrl } from "@/lib/video-embed";
import { AddToSessionButton } from "@/components/app/add-to-session-dialog";
import { AddToOpenEditorButton } from "@/components/app/add-to-open-editor-button";
import { ShareButton } from "@/components/app/share-button";
import { PrevNextNav } from "@/components/app/prev-next-nav";
import { LevelBalls } from "@/components/app/level-balls";
import { BackToSearchLink } from "@/components/app/back-to-search-link";
import {
  CopyToSpaceButton,
  type CopyTarget,
} from "@/components/app/copy-to-space-button";

type Category = "technique" | "tactics" | "fitness" | "warm-up";
type Difficulty = "beginner" | "intermediate" | "advanced";
type Location = "pista" | "pared" | "playa" | "casa";
type Phase = "activation" | "main" | "cooldown";
type Formato = "individual" | "parejas" | "grupal" | "multigrupo";
type TipoActividad =
  | "tecnico_tactico"
  | "fisico"
  | "cognitivo"
  | "competitivo"
  | "ludico";

export interface ExerciseData {
  id: string;
  name: string;
  sport: string;
  description: string | null;
  category: Category;
  difficulty: Difficulty;
  durationMinutes: number;
  objectives: string | null;
  steps: Array<{ title: string; description: string }> | null;
  materials: string[] | null;
  location: Location | null;
  videoUrl: string | null;
  tips: string | null;
  imageUrl: string | null;
  imageUrls: string[] | null;
  variantes: string | null;
  observaciones: string | null;
  formato: Formato | null;
  numJugadores: number | null;
  tipoPelota: TipoPelota | null;
  tipoActividad: TipoActividad | null;
  tiposActividad: string[] | null;
  caracter: string[] | null;
  situacionJuego: string[] | null;
  golpes: string[] | null;
  efecto: string[] | null;
  nivel: string | null;
  niveles: string[] | null;
  aspectoJuego: string | null;
  aspectosJuego: string[] | null;
  parametro: string | null;
  parametros: string[] | null;
  tipologia: string | null;
  duracionRango: string | null;
  phase: Phase | null;
  intensity: number | null;
  isGlobal: boolean;
  autoria: string | null;
  isAiGenerated: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SavedListSummary {
  id: string;
  name: string;
  emoji: string | null;
  itemsCount?: number;
}

const CATEGORY_META: Record<
  Category,
  { label: string; icon: React.ElementType }
> = {
  technique: {
    label: "Técnica",
    icon: Target,
  },
  tactics: {
    label: "Táctica",
    icon: Brain,
  },
  fitness: {
    label: "Fitness",
    icon: Dumbbell,
  },
  "warm-up": {
    label: "Calentamiento",
    icon: Flame,
  },
};

const LOCATION_LABELS: Record<string, string> = {
  pista: "Pista/cancha",
  pared: "🧱 Pared",
  playa: "🏖️ Playa",
  casa: "🏠 Casa",
  // Legacy values (still in DB):
  indoor: "🏟️ Pista cubierta",
  outdoor: "☀️ Pista exterior",
  any: "📍 Cualquier lugar",
};

const FORMATO_LABELS: Record<Formato, string> = {
  individual: "Individual",
  parejas: "Parejas",
  grupal: "Grupal",
  multigrupo: "Multigrupo",
};

const LEGACY_TIPO_ACTIVIDAD_LABELS: Record<TipoActividad, string> = {
  tecnico_tactico: "Técnico-táctico",
  fisico: "Físico",
  cognitivo: "Cognitivo",
  competitivo: "Competitivo",
  ludico: "Lúdico",
};

const GOLPE_LABELS: Record<string, string> = {
  derecha: "Derecha",
  reves: "Revés",
  globo: "Globo",
  smash: "Smash",
  bandeja: "Bandeja",
  volea_dcha: "Volea dcha.",
  volea_rev: "Volea rev.",
  bajada_pared: "Bajada pared",
  vibora: "Víbora",
  saque: "Saque",
  chiquita: "Chiquita",
  dejada: "Dejada",
  volea: "Volea",
  remate: "Remate",
  resto: "Resto",
};

const EFECTO_LABELS: Record<string, string> = {
  liftado: "Liftado",
  cortado: "Cortado",
  plano: "Plano",
  sin_efecto: "Sin efecto",
};

export function ExerciseDetailClient({
  exercise,
  canEdit = false,
  copyTargets = [],
  inClub = false,
  isAdmin = false,
  userId = null,
  initialRating = null,
  ratingAvg = null,
  ratingTotal = 0,
  diagram = null,
  prevHref = null,
  nextHref = null,
  navPosition = null,
  navTotal = null,
  backToSearchHref = null,
}: {
  exercise: ExerciseData;
  canEdit?: boolean;
  copyTargets?: CopyTarget[];
  inClub?: boolean;
  isAdmin?: boolean;
  userId?: string | null;
  initialRating?: number | null;
  ratingAvg?: number | null;
  ratingTotal?: number;
  diagram?: Diagram | null;
  prevHref?: string | null;
  nextHref?: string | null;
  navPosition?: number | null;
  navTotal?: number | null;
  backToSearchHref?: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [showListPicker, setShowListPicker] = useState(false);
  const [savedInLists, setSavedInLists] = useState<SavedListSummary[]>([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const cat = CATEGORY_META[exercise.category];
  const CategoryIcon = cat.icon;

  const refreshSavedLists = useCallback(async () => {
    if (!userId) return;

    setLoadingLists(true);
    try {
      const res = await fetch(
        `/api/exercise-lists?exerciseId=${encodeURIComponent(exercise.id)}`,
        { cache: "no-store" }
      );
      const payload = (await res.json().catch(() => ({}))) as {
        data?: Array<{
          id: string;
          name: string;
          emoji: string | null;
          itemsCount?: number;
          containsExercise?: boolean;
        }>;
      };

      setSavedInLists(
        Array.isArray(payload.data)
          ? payload.data
              .filter((list) => list.containsExercise)
              .map((list) => ({
                id: list.id,
                name: list.name,
                emoji: list.emoji,
                itemsCount: list.itemsCount ?? 0,
              }))
          : []
      );
    } finally {
      setLoadingLists(false);
    }
  }, [exercise.id, userId]);

  useEffect(() => {
    const id = window.setTimeout(() => void refreshSavedLists(), 0);
    return () => window.clearTimeout(id);
  }, [refreshSavedLists]);

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/exercises/${exercise.id}/pdf`);
      if (!res.ok) throw new Error("Error generando PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ??
        `ejercicio-${exercise.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silencioso — el botón vuelve a su estado normal
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/exercises/${exercise.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setDeleteError("No se pudo eliminar el ejercicio. Inténtalo de nuevo.");
      setDeleting(false);
      return;
    }
    router.push("/exercises");
    router.refresh();
  }

  if (mode === "edit" && canEdit) {
    return (
      <div className="w-full space-y-6 bg-[#F4F4F1] px-4 py-8 text-[#050505] dark:bg-[#050505] dark:text-[#F4F4F1] md:px-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMode("view")}
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#050505]/12 bg-white text-muted-foreground transition-colors hover:border-[#D6FF38] hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="font-heading text-3xl font-bold tracking-tight text-foreground">
              Editar ejercicio
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Modifica los datos del ejercicio
            </p>
          </div>
        </div>
        <div className="rounded-lg border border-[#050505]/10 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-white/[0.04]">
          <ExerciseForm
            mode="edit"
            exerciseId={exercise.id}
            isAdmin={isAdmin}
            sport={exercise.sport}
            initialData={{
              name: exercise.name,
              description: exercise.description,
              category: exercise.category,
              difficulty: exercise.difficulty,
              durationMinutes: exercise.durationMinutes,
              objectives: exercise.objectives,
              steps: exercise.steps,
              materials: exercise.materials,
              location: exercise.location,
              videoUrl: exercise.videoUrl,
              tips: exercise.tips,
              imageUrl: exercise.imageUrl,
              imageUrls: exercise.imageUrls,
              variantes: exercise.variantes,
              observaciones: exercise.observaciones,
              formato: exercise.formato,
              numJugadores: exercise.numJugadores,
              tipoPelota: exercise.tipoPelota,
              tipoActividad: exercise.tipoActividad,
              tiposActividad: exercise.tiposActividad as never,
              caracter: exercise.caracter,
              situacionJuego: exercise.situacionJuego,
              golpes: exercise.golpes,
              efecto: exercise.efecto,
              nivel: exercise.nivel as never,
              niveles: exercise.niveles as never,
              aspectoJuego: exercise.aspectoJuego as never,
              aspectosJuego: exercise.aspectosJuego as never,
              parametro: exercise.parametro as never,
              parametros: exercise.parametros as never,
              tipologia: exercise.tipologia as never,
              duracionRango: exercise.duracionRango as never,
              phase: exercise.phase,
              intensity: exercise.intensity,
              isGlobal: exercise.isGlobal,
              autoria: exercise.autoria,
            }}
            onSuccess={() => {
              setMode("view");
              router.refresh();
            }}
            onCancel={() => setMode("view")}
          />
        </div>
      </div>
    );
  }

  const niveles = exercise.niveles?.length
    ? exercise.niveles
    : exercise.nivel
      ? [exercise.nivel]
      : [];
  const aspectosJuego = exercise.aspectosJuego?.length
    ? exercise.aspectosJuego
    : exercise.aspectoJuego
      ? [exercise.aspectoJuego]
      : [];
  const parametros = exercise.parametros?.length
    ? exercise.parametros
    : exercise.parametro
      ? [exercise.parametro]
      : [];
  const tiposActividad = exercise.tiposActividad?.length
    ? exercise.tiposActividad
    : exercise.tipologia
      ? [exercise.tipologia]
      : exercise.tipoActividad
        ? [exercise.tipoActividad]
        : [];

  const videoEmbedUrl = getYouTubeEmbedUrl(exercise.videoUrl);

  const hasParams =
    exercise.formato ||
    exercise.numJugadores ||
    exercise.tipoPelota ||
    niveles.length > 0 ||
    aspectosJuego.length > 0 ||
    parametros.length > 0 ||
    tiposActividad.length > 0 ||
    (exercise.caracter?.length ?? 0) > 0 ||
    (exercise.situacionJuego?.length ?? 0) > 0 ||
    exercise.duracionRango ||
    (exercise.golpes && exercise.golpes.length > 0) ||
    (exercise.efecto && exercise.efecto.length > 0);

  return (
    <div className="relative min-h-full overflow-hidden bg-[#F4F4F1] px-4 py-6 text-[#050505] dark:bg-[#050505] dark:text-[#F4F4F1] sm:px-6 md:px-10 lg:px-12">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_78%_18%,rgba(214,255,56,0.22),transparent_34%),linear-gradient(180deg,rgba(5,5,5,0.06),transparent)] dark:bg-[radial-gradient(circle_at_78%_18%,rgba(214,255,56,0.16),transparent_34%)]" />
      {/* Header */}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/exercises"
            title="Volver a todos los ejercicios"
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#050505]/12 bg-white text-muted-foreground shadow-sm transition-colors hover:border-[#D6FF38] hover:text-foreground dark:border-white/10 dark:bg-white/[0.04]"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <BackToSearchLink href={backToSearchHref} />
          <Link
            href="/exercises"
            title="Volver a todos los ejercicios"
            className="text-xs text-muted-foreground font-medium truncate transition-colors hover:text-foreground hover:underline"
          >
            Biblioteca de ejercicios
          </Link>
          <PrevNextNav
            prevHref={prevHref}
            nextHref={nextHref}
            position={navPosition}
            total={navTotal}
            className="ml-1"
          />
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:items-end">
          {userId && <AddToOpenEditorButton exerciseId={exercise.id} />}
          {canEdit ? (
            <div className="flex w-full items-center gap-2 sm:w-auto sm:shrink-0">
              <button
                onClick={() => setMode("edit")}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[#050505]/12 bg-white px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-[#D6FF38] hover:text-foreground dark:border-white/10 dark:bg-white/[0.04] sm:flex-none"
              >
                <Pencil className="size-3.5" />
                <span className="hidden sm:inline">Editar</span>
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-full border border-destructive/30 bg-white px-4 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 dark:bg-white/[0.04] sm:flex-none"
              >
                <Trash2 className="size-3.5" />
                <span className="hidden sm:inline">Eliminar</span>
              </button>
            </div>
          ) : userId && exercise.isGlobal && !isAdmin ? (
            <div className="flex w-full items-center gap-1.5 rounded-full border border-[#050505]/12 bg-white/70 px-3 py-2 text-[11px] text-muted-foreground shadow-sm dark:border-white/10 dark:bg-white/[0.04] sm:w-auto sm:shrink-0">
              <ShieldAlert className="size-3.5 shrink-0" strokeWidth={1.6} />
              <span className="hidden sm:inline">
                Solo administradores pueden modificar ejercicios globales
              </span>
              <span className="sm:hidden">Solo admins</span>
            </div>
          ) : null}
          {copyTargets.length > 0 && (
            <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
              <CopyToSpaceButton
                kind="exercise"
                id={exercise.id}
                targets={copyTargets}
                inClub={inClub}
                className="flex-1 sm:flex-none"
              />
            </div>
          )}
        </div>
      </div>

      {/* Main card */}
      <div className="relative overflow-hidden rounded-lg border border-[#050505]/10 bg-white shadow-[0_24px_70px_rgba(5,5,5,0.10)] dark:border-white/10 dark:bg-white/[0.04]">
        {/* Category stripe */}
        <div className="border-b border-white/10 bg-[#050505] px-4 py-5 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <LevelBalls
              niveles={niveles}
              sport={exercise.sport}
              className="order-last ml-auto"
            />
            <div className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[#D6FF38]/40 bg-[#D6FF38]">
              <CategoryIcon className="size-5 text-[#050505]" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#D6FF38]">
                {cat.label}
              </p>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="flex items-center gap-1 text-xs text-white/66">
                  <Clock className="size-3" />
                  {exercise.durationMinutes} min
                </span>
                {exercise.location && (
                  <>
                    <span className="text-xs text-white/35">·</span>
                    <span className="text-xs text-white/66">
                      {LOCATION_LABELS[exercise.location]}
                    </span>
                  </>
                )}
                {exercise.isGlobal && (
                  <>
                    <span className="text-xs text-white/35">·</span>
                    <span className="inline-flex items-center gap-1 text-xs text-[#D6FF38]">
                      <BookMarked className="size-3" />
                      {autoriaLabel(exercise.autoria)}
                    </span>
                  </>
                )}
                {false && exercise.intensity && (
                  <>
                    <span className="text-xs text-white/35">·</span>
                    <span className="text-xs text-white/66">
                      Intensidad {exercise.intensity}/5
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Hero image */}
        {exercise.imageUrl && (
          <div className="relative aspect-video w-full overflow-hidden bg-[#050505]">
            <Image
              src={exercise.imageUrl}
              alt={exercise.name}
              fill
              className="object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="space-y-6 p-4 sm:p-6">
          <h1 className="max-w-4xl font-heading text-3xl font-semibold leading-tight tracking-normal text-foreground sm:text-4xl">
            {exercise.name}
          </h1>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2">
            <ShareButton
              title={exercise.name}
              text={`Ejercicio: ${exercise.name}`}
              className="inline-flex items-center gap-2 rounded-full border border-[#050505]/12 bg-[#F4F4F1] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-[#D6FF38] hover:bg-[#D6FF38]/15 dark:border-white/10 dark:bg-[#050505]"
            />
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-[#050505]/12 bg-[#F4F4F1] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-[#D6FF38] hover:bg-[#D6FF38]/15 dark:border-white/10 dark:bg-[#050505]",
                downloadingPdf && "opacity-60"
              )}
            >
              {downloadingPdf ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <FileDown className="size-4" strokeWidth={1.6} />
              )}
              PDF
            </button>
            {userId && (
              <>
                <button
                  type="button"
                  onClick={() => setShowListPicker(true)}
                  className="inline-flex items-center gap-2 rounded-full border border-[#050505]/12 bg-[#F4F4F1] px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-[#D6FF38] hover:bg-[#D6FF38]/15 dark:border-white/10 dark:bg-[#050505]"
                >
                  <BookMarked className="size-4 text-brand" strokeWidth={1.6} />
                  {savedInLists.length > 0
                    ? `En ${savedInLists.length} lista${savedInLists.length !== 1 ? "s" : ""}`
                    : "Guardar"}
                </button>
                <AddToSessionButton
                  exerciseIds={[exercise.id]}
                  label={exercise.name}
                />
                <AddToClassButton
                  exerciseId={exercise.id}
                  label={exercise.name}
                />
              </>
            )}
            {!userId && (
              <Link
                href="/login"
                className="inline-flex items-center gap-2 rounded-full border border-[#D6FF38]/50 bg-[#D6FF38]/15 px-4 py-2 text-sm font-semibold text-[#5E6F00] transition-colors hover:bg-[#D6FF38]/25 dark:text-[#D6FF38]"
              >
                <Lock className="size-3.5" strokeWidth={1.8} />
                Inicia sesión para guardar
              </Link>
            )}
          </div>

          {/* Rating */}
          <div className="flex items-center gap-3">
            <ExerciseRating
              exerciseId={exercise.id}
              initialRating={initialRating}
              avgRating={ratingAvg ?? 0}
              totalRatings={ratingTotal}
              readonly={!userId}
            />
          </div>

          {userId ? (
            <div className="rounded-lg border border-[#050505]/10 bg-[#F4F4F1] p-4 dark:border-white/10 dark:bg-[#050505]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    En tus listas
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {savedInLists.length > 0
                      ? "Este ejercicio ya está organizado dentro de tus colecciones."
                      : "Todavía no está en ninguna lista. Guárdalo para recuperarlo más rápido."}
                  </p>
                </div>
                {loadingLists ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : null}
              </div>

              {savedInLists.length > 0 ? (
                <>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {savedInLists.map((list) => (
                      <span
                        key={list.id}
                        className="inline-flex items-center gap-2 rounded-full border border-[#050505]/10 bg-white px-3 py-2 text-sm text-foreground dark:border-white/10 dark:bg-white/[0.04]"
                      >
                        <span>{list.emoji ?? "📋"}</span>
                        <span>{list.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {list.itemsCount ?? 0}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className="mt-4">
                    <Link
                      href="/exercises?view=lists"
                      className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#5E6F00] transition-colors hover:text-[#050505] dark:text-[#D6FF38] dark:hover:text-white"
                    >
                      Ver todas tus listas
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {/* Params badges */}
          {hasParams && (
            <div className="flex flex-wrap gap-2">
              {exercise.formato && (
                <span className="rounded-full bg-[#050505]/6 px-2.5 py-1 text-xs font-semibold text-foreground dark:bg-white/10">
                  👥 {FORMATO_LABELS[exercise.formato]}
                </span>
              )}
              {exercise.numJugadores && (
                <span className="rounded-full bg-[#050505]/6 px-2.5 py-1 text-xs font-semibold text-foreground dark:bg-white/10">
                  {exercise.numJugadores} jugadores
                </span>
              )}
              {tiposActividad.map((tipo) => (
                <span
                  key={tipo}
                  className="rounded-full bg-[#050505]/6 px-2.5 py-1 text-xs font-semibold text-foreground dark:bg-white/10"
                >
                  {TIPO_ACTIVIDAD_LABELS[
                    tipo as keyof typeof TIPO_ACTIVIDAD_LABELS
                  ] ??
                    LEGACY_TIPO_ACTIVIDAD_LABELS[tipo as TipoActividad] ??
                    tipo.replace(/_/g, " ")}
                </span>
              ))}
              {niveles.map((nivel) => (
                <span
                  key={nivel}
                  className="rounded-full bg-[#050505]/6 px-2.5 py-1 text-xs font-semibold text-foreground dark:bg-white/10"
                >
                  Nivel: {nivelLabel(nivel)}
                </span>
              ))}
              {aspectosJuego.map((aspecto) => (
                <span
                  key={aspecto}
                  className="rounded-full bg-[#050505]/6 px-2.5 py-1 text-xs font-semibold text-foreground dark:bg-white/10"
                >
                  {ASPECTO_JUEGO_LABELS[
                    aspecto as keyof typeof ASPECTO_JUEGO_LABELS
                  ] ?? aspecto.replace(/_/g, " ")}
                </span>
              ))}
              {parametros.map((parametro) => (
                <span
                  key={parametro}
                  className="rounded-full bg-[#050505]/6 px-2.5 py-1 text-xs font-semibold text-foreground dark:bg-white/10"
                >
                  Parámetro: {parametro.replace(/_/g, " ")}
                </span>
              ))}
              {exercise.duracionRango && (
                <span className="rounded-full bg-[#050505]/6 px-2.5 py-1 text-xs font-semibold text-foreground dark:bg-white/10">
                  {exercise.duracionRango} min
                </span>
              )}
              {exercise.tipoPelota && (
                <span className="rounded-full bg-[#050505]/6 px-2.5 py-1 text-xs font-semibold text-foreground dark:bg-white/10">
                  🎾 {pelotaLabel(exercise.tipoPelota)}
                </span>
              )}
              {exercise.caracter?.map((c) => (
                <span
                  key={`caracter-${c}`}
                  className="rounded-full bg-[#050505]/6 px-2.5 py-1 text-xs font-semibold text-foreground dark:bg-white/10"
                >
                  {caracterLabel(c)}
                </span>
              ))}
              {exercise.situacionJuego?.map((sj) => (
                <span
                  key={`situacion-${sj}`}
                  className="rounded-full bg-[#050505]/6 px-2.5 py-1 text-xs font-semibold text-foreground dark:bg-white/10"
                >
                  Situación: {situacionJuegoLabel(sj)}
                </span>
              ))}
              {exercise.golpes &&
                exercise.golpes.map((g) => (
                  <span
                    key={g}
                    className="rounded-full bg-[#D6FF38]/15 px-2.5 py-1 text-xs font-semibold text-[#5E6F00] dark:text-[#D6FF38]"
                  >
                    {GOLPE_LABELS[g] ?? g}
                  </span>
                ))}
              {exercise.efecto &&
                exercise.efecto.map((e) => (
                  <span
                    key={e}
                    className="rounded-full bg-[#050505]/6 px-2.5 py-1 text-xs font-semibold text-foreground dark:bg-white/10"
                  >
                    {EFECTO_LABELS[e] ?? e}
                  </span>
                ))}
            </div>
          )}

          {exercise.objectives && (
            <div className="bg-brand/5 border border-brand/20 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-brand uppercase tracking-widest mb-1">
                Objetivo
              </p>
              <p className="text-sm text-foreground">{exercise.objectives}</p>
            </div>
          )}

          {exercise.description && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Descripción
              </p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {exercise.description}
              </p>
            </div>
          )}

          {diagram && <ExerciseDiagramView diagram={diagram} maxWidth={300} />}

          {exercise.steps && exercise.steps.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <ListOrdered className="size-4 text-muted-foreground" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Pasos de ejecución
                </p>
              </div>
              <div className="space-y-3">
                {exercise.steps.map((step, idx) => (
                  <div key={idx} className="flex gap-3">
                    <span className="size-6 rounded-lg bg-brand/10 text-brand text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {step.title}
                      </p>
                      {step.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 leading-relaxed">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {exercise.materials && exercise.materials.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Package className="size-4 text-muted-foreground" />
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  Materiales
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {exercise.materials.map((m) => (
                  <span
                    key={m}
                    className="text-xs font-medium bg-muted text-foreground px-2.5 py-1 rounded-lg"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {exercise.tips && (
            <div className="bg-amber-400/5 border border-amber-400/20 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Lightbulb className="size-3.5 text-amber-400" />
                <p className="text-xs font-bold text-amber-400 uppercase tracking-widest">
                  Tips del entrenador
                </p>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {exercise.tips}
              </p>
            </div>
          )}

          {exercise.variantes && (
            <div className="bg-muted/50 border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <Shuffle className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Variantes
                </p>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {exercise.variantes}
              </p>
            </div>
          )}

          {exercise.observaciones && (
            <div className="bg-muted/50 border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <StickyNote className="size-3.5 text-muted-foreground" />
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                  Observaciones
                </p>
              </div>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {exercise.observaciones}
              </p>
            </div>
          )}

          {exercise.videoUrl && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                Vídeo de referencia
              </p>
              {videoEmbedUrl && (
                <div className="relative mb-2 aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
                  <iframe
                    src={videoEmbedUrl}
                    title={`Vídeo: ${exercise.name}`}
                    className="absolute inset-0 size-full"
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              )}
              <a
                href={exercise.videoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm text-brand hover:text-brand/80 transition-colors font-medium"
              >
                <Video className="size-4" />
                {videoEmbedUrl ? "Ver en YouTube" : "Ver vídeo"}
                <ExternalLink className="size-3" />
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="relative w-full max-w-sm rounded-lg border border-border bg-card p-6 shadow-2xl">
            <div className="flex items-start gap-4 mb-5">
              <div className="size-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="size-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">
                  Eliminar ejercicio
                </h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  ¿Seguro que quieres eliminar{" "}
                  <span className="font-medium text-foreground">
                    {exercise.name}
                  </span>
                  ? Esta acción no se puede deshacer.
                </p>
              </div>
              <button
                onClick={() => !deleting && setShowDeleteConfirm(false)}
                className="size-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="size-4" />
              </button>
            </div>
            {deleteError && (
              <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                <p className="text-xs text-destructive">{deleteError}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => !deleting && setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 text-sm font-medium text-muted-foreground border border-border px-4 py-2.5 rounded-xl hover:bg-muted hover:text-foreground transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-destructive text-destructive-foreground text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-destructive/90 active:scale-95 transition-all duration-150 disabled:opacity-60"
              >
                {deleting && <Loader2 className="size-4 animate-spin" />}
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List picker modal */}
      {showListPicker && userId && (
        <ExerciseListPicker
          exerciseId={exercise.id}
          onClose={() => {
            setShowListPicker(false);
            void refreshSavedLists();
          }}
        />
      )}
    </div>
  );
}
