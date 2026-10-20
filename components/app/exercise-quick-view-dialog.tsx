"use client";

import Link from "next/link";
import { ArrowRight, Clock, ExternalLink, Video } from "lucide-react";
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
}: {
  exercise: QuickViewExercise | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-border bg-black">
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

            <Link
              href={`/exercises/${exercise.id}`}
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
