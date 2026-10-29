"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight,
  CalendarPlus,
  Clock,
  ExternalLink,
  GraduationCap,
  Play,
  Video,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getYouTubeEmbedUrl } from "@/lib/video-embed";

export interface QuickViewExercise {
  id: string;
  name: string;
  category: string;
  durationMinutes: number;
  description?: string | null;
  objectives?: string | null;
  videoUrl?: string | null;
}

const CATEGORY_LABELS: Record<string, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Físico",
  "warm-up": "Calentamiento",
};

/**
 * Vista rápida de un ejercicio: descripción, objetivos y vídeo (si lo tiene)
 * sin salir de la pantalla en la que estás (una colección, por ejemplo).
 * Siempre ofrece ir a la ficha completa.
 */
export function ExerciseQuickViewDialog({
  exercise,
  open,
  onOpenChange,
  fromListId,
  onAddToSession,
  onAddToClass,
}: {
  /** Colección desde la que se abre: la ficha ofrecerá volver a ella. */
  fromListId?: string;
  exercise: QuickViewExercise | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Si se pasan, la vista rápida ofrece añadir el ejercicio a una sesión / clase. */
  onAddToSession?: (exercise: QuickViewExercise) => void;
  onAddToClass?: (exercise: QuickViewExercise) => void;
}) {
  const videoEmbedUrl = getYouTubeEmbedUrl(exercise?.videoUrl);
  const description = exercise?.description?.trim();
  const objectives = exercise?.objectives?.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        {exercise ? (
          <>
            <DialogHeader>
              <DialogTitle className="break-words pr-6 leading-snug">
                {exercise.name}
              </DialogTitle>
              <DialogDescription className="flex flex-wrap items-center gap-2 text-xs">
                <span>
                  {CATEGORY_LABELS[exercise.category] ?? exercise.category}
                </span>
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="size-3" />
                  {exercise.durationMinutes} min
                </span>
              </DialogDescription>
            </DialogHeader>

            {exercise.videoUrl ? (
              <div className="space-y-2">
                {videoEmbedUrl ? (
                  <VideoEmbed
                    key={videoEmbedUrl}
                    embedUrl={videoEmbedUrl}
                    title={exercise.name}
                  />
                ) : null}
                <a
                  href={exercise.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand/80"
                >
                  <Video className="size-4" />
                  {videoEmbedUrl ? "Ver en YouTube" : "Ver vídeo"}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            ) : null}

            {description ? (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Descripción
                </p>
                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground">
                  {description}
                </p>
              </div>
            ) : null}

            {objectives ? (
              <div>
                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  Objetivos
                </p>
                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-foreground">
                  {objectives}
                </p>
              </div>
            ) : null}

            {!description && !objectives && !exercise.videoUrl ? (
              <p className="text-sm text-muted-foreground">
                Este ejercicio aún no tiene descripción. Abre la ficha completa
                para ver todo lo que tiene.
              </p>
            ) : null}

            <div className="flex flex-wrap gap-2">
              {onAddToSession ? (
                <button
                  type="button"
                  onClick={() => onAddToSession(exercise)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-brand/40 px-4 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
                >
                  <CalendarPlus className="size-4" />
                  Añadir a sesión
                </button>
              ) : null}
              {onAddToClass ? (
                <button
                  type="button"
                  onClick={() => onAddToClass(exercise)}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-brand/40 px-4 text-sm font-semibold text-brand transition-colors hover:bg-brand/10"
                >
                  <GraduationCap className="size-4" />
                  Añadir a clase
                </button>
              ) : null}
            </div>

            <Link
              href={`/exercises/${exercise.id}${
                fromListId ? `?desdeLista=${fromListId}` : ""
              }`}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-full bg-brand px-5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
            >
              Ver ficha completa
              <ArrowRight className="size-4" />
            </Link>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Vídeo de YouTube con portada y botón de play: no carga el reproductor hasta
 * que el usuario lo pulsa, y entonces arranca dentro de la propia vista.
 */
function VideoEmbed({ embedUrl, title }: { embedUrl: string; title: string }) {
  const [playing, setPlaying] = useState(false);
  const videoId = embedUrl.match(/\/embed\/([A-Za-z0-9_-]{11})/)?.[1];

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
      {playing ? (
        <iframe
          src={(() => {
            const u = new URL(embedUrl);
            u.searchParams.set("autoplay", "1");
            return u.toString();
          })()}
          title={`Vídeo: ${title}`}
          className="absolute inset-0 size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Reproducir vídeo: ${title}`}
          className="group absolute inset-0 size-full"
        >
          {videoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-90 transition-opacity group-hover:opacity-100"
            />
          ) : null}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex size-16 items-center justify-center rounded-full bg-[#D6FF38] text-[#050505] shadow-lg transition-transform group-hover:scale-105">
              <Play className="ml-1 size-7 fill-current" />
            </span>
          </span>
        </button>
      )}
    </div>
  );
}
