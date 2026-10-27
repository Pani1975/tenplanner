"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Mic, RotateCcw, Square, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Duración máxima de una nota de voz (debe coincidir con el servidor). */
const MAX_SECONDS = 120;

export interface VoiceNoteSaved {
  url: string | null;
  seconds: number;
}

interface SessionVoiceNoteProps {
  /** URL (firmada) del audio guardado, si lo hay. */
  url: string | null | undefined;
  seconds: number | null | undefined;
  /** Sube la grabación; devuelve el audio guardado o null si falla. */
  onUpload: (blob: Blob, seconds: number) => Promise<VoiceNoteSaved | null>;
  /** Elimina el audio guardado; devuelve true si se borró. */
  onDelete: () => Promise<boolean>;
  /** Solo lectura: no se muestra nada si no hay audio. */
  readOnly?: boolean;
  addLabel?: string;
  className?: string;
}

function formatClock(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Primer formato de grabación que admita el navegador (Chrome/Android:
 * webm; Safari/iOS: mp4). */
function pickRecorderMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type));
}

type Phase = "idle" | "recording" | "uploading";

/**
 * Nota de voz: graba (máx. 2 min), guarda y reproduce. Sin transcripción ni
 * interpretación: el audio se guarda tal cual para que el monitor lo escuche
 * después, en cada ejercicio o en la sesión en general.
 */
export function SessionVoiceNote({
  url,
  seconds,
  onUpload,
  onDelete,
  readOnly = false,
  addLabel = "Nota de voz",
  className,
}: SessionVoiceNoteProps) {
  const [saved, setSaved] = useState<VoiceNoteSaved | null>(
    url ? { url, seconds: seconds ?? 0 } : null
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const cancelledRef = useRef(false);

  const releaseMic = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }, []);

  // Si se sale de la pantalla grabando, se descarta y se libera el micrófono.
  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (recorderRef.current?.state === "recording")
        recorderRef.current.stop();
      releaseMic();
    };
  }, [releaseMic]);

  if (readOnly && !saved?.url) return null;

  async function startRecording() {
    setError(null);
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setError("Este navegador no permite grabar audio.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError(
        "No se pudo acceder al micrófono. Revisa el permiso del navegador."
      );
      return;
    }

    const mimeType = pickRecorderMime();
    const recorder = new MediaRecorder(
      stream,
      mimeType ? { mimeType } : undefined
    );
    chunksRef.current = [];
    cancelledRef.current = false;
    streamRef.current = stream;
    recorderRef.current = recorder;

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = async () => {
      const durationSeconds = Math.max(
        1,
        Math.round((Date.now() - startedAtRef.current) / 1000)
      );
      releaseMic();
      if (cancelledRef.current) return;
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || mimeType || "audio/webm",
      });
      if (blob.size === 0) {
        setPhase("idle");
        setError("No se grabó nada. Inténtalo de nuevo.");
        return;
      }
      setPhase("uploading");
      const result = await onUpload(
        blob,
        Math.min(durationSeconds, MAX_SECONDS)
      );
      setPhase("idle");
      if (result) {
        setSaved(result);
        setConfirmDelete(false);
      } else {
        setError("No se pudo guardar la nota de voz. Inténtalo de nuevo.");
      }
    };

    startedAtRef.current = Date.now();
    setElapsed(0);
    setPhase("recording");
    recorder.start();
    timerRef.current = window.setInterval(() => {
      const secondsElapsed = Math.floor(
        (Date.now() - startedAtRef.current) / 1000
      );
      setElapsed(secondsElapsed);
      if (secondsElapsed >= MAX_SECONDS && recorder.state === "recording")
        recorder.stop();
    }, 250);
  }

  function stopRecording() {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    const ok = await onDelete();
    setDeleting(false);
    if (ok) {
      setSaved(null);
      setConfirmDelete(false);
    } else {
      setError("No se pudo eliminar la nota de voz.");
    }
  }

  if (phase === "recording") {
    return (
      <div
        className={cn(
          "flex items-center gap-3 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2",
          className
        )}
      >
        <span className="relative flex size-2.5">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-destructive/60" />
          <span className="relative inline-flex size-2.5 rounded-full bg-destructive" />
        </span>
        <span className="text-xs font-semibold tabular-nums text-foreground">
          {formatClock(elapsed)} / {formatClock(MAX_SECONDS)}
        </span>
        <button
          type="button"
          onClick={stopRecording}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-destructive px-3 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-destructive/90"
        >
          <Square className="size-3 fill-current" />
          Parar y guardar
        </button>
      </div>
    );
  }

  if (phase === "uploading") {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-2 text-[11px] text-muted-foreground",
          className
        )}
      >
        <Loader2 className="size-3.5 animate-spin" />
        Guardando nota de voz…
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)}>
      {saved?.url ? (
        <div className="space-y-1.5">
          <audio
            controls
            preload="none"
            src={saved.url}
            className="h-9 w-full max-w-md"
          >
            Tu navegador no puede reproducir este audio.
          </audio>
          {!readOnly && (
            <div className="flex flex-wrap items-center gap-2 text-[11px]">
              <span className="tabular-nums text-muted-foreground">
                {formatClock(saved.seconds)}
              </span>
              <button
                type="button"
                onClick={() => void startRecording()}
                className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
              >
                <RotateCcw className="size-3" />
                Volver a grabar
              </button>
              {confirmDelete ? (
                <>
                  <span className="text-muted-foreground">
                    ¿Eliminar la nota?
                  </span>
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    className="inline-flex items-center gap-1 rounded-full bg-destructive px-2.5 py-1 font-semibold text-white disabled:opacity-60"
                  >
                    {deleting && <Loader2 className="size-3 animate-spin" />}
                    Eliminar
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="rounded-full px-2 py-1 font-medium text-muted-foreground hover:text-foreground"
                  >
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 font-medium text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                >
                  <Trash2 className="size-3" />
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => void startRecording()}
          className="inline-flex items-center gap-1.5 rounded-full border border-border/70 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
        >
          <Mic className="size-3" />
          {addLabel}
        </button>
      )}
      {error && <p className="text-[11px] text-destructive">{error}</p>}
    </div>
  );
}
