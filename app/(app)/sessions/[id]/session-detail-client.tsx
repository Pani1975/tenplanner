"use client";

import { ExerciseDiagramView } from "@/components/app/exercise-diagram";
import type { Diagram } from "@/lib/exercise-diagrams/types";
import { useState } from "react";
import { SessionCommentBox } from "@/components/app/session-comment-box";
import {
  SessionVoiceNote,
  type VoiceNoteSaved,
} from "@/components/app/session-voice-note";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  SessionCloseDialog,
  type RatingAfterEdit,
  type SessionCloseRating,
} from "@/components/app/session-close-dialog";
import { planChangeReasonLabel } from "@/lib/sessions/plan-change";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  X,
  Loader2,
  Calendar,
  Clock,
  Dumbbell,
  CheckCircle2,
  XCircle,
  Circle,
  FileDown,
  Copy,
  Star,
  Play,
  CalendarClock,
  BookmarkPlus,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { SessionDateDialog } from "@/components/app/session-date-dialog";
import { SessionFavoriteToggle } from "@/components/app/session-favorite-toggle";
import type { AvailableExercise } from "@/components/app/session-form";
import { SessionAnalyticsView } from "@/components/app/session-analytics";
import type { SessionAnalytics } from "@/lib/sessions/analytics";
import { cn } from "@/lib/utils";
import { ASPECTO_JUEGO_LABELS } from "@/lib/exercise-taxonomy";
import { Package } from "lucide-react";
import { PrevNextNav } from "@/components/app/prev-next-nav";
import { BackToSearchLink } from "@/components/app/back-to-search-link";
import { SessionInfoSummary } from "@/components/app/session-info-summary";
import { ClassAnimationButton } from "@/components/app/class-animation-player";
import { hasSessionAnimation } from "@/lib/classes/animation";
import { useTranslations } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";
import { useLocale } from "next-intl";

const CATEGORY_COLORS: Record<string, string> = {
  technique: "text-blue-400 bg-blue-400/10",
  tactics: "text-purple-400 bg-purple-400/10",
  fitness: "text-amber-400 bg-amber-400/10",
  "warm-up": "text-brand bg-brand/10",
};

const CATEGORY_LABELS: Record<string, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Fitness",
  "warm-up": "Calentamiento",
};

const DIFFICULTY_META: Record<string, { label: string; color: string }> = {
  beginner: { label: "Principiante", color: "text-brand" },
  intermediate: { label: "Intermedio", color: "text-amber-400" },
  advanced: { label: "Avanzado", color: "text-red-400" },
};

export interface SessionData {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  durationMinutes: number;
  userId: string;
  createdAt: string;
  updatedAt: string;
  objective: string | null;
  material: string | null;
  observations: string | null;
  /** Comentario del monitor sobre la sesión en general. */
  coachComment?: string | null;
  coachRating?: number | null;
  /** ¿Se dio tal y como estaba planificada? null = sin responder. */
  planFollowed?: boolean | null;
  planChangeReason?: string | null;
  /** Texto del motivo "Otro" (o motivo de cancelación). */
  statusNote?: string | null;
  /** Nota de voz de la sesión (URL firmada; solo para el monitor dueño). */
  coachAudioUrl?: string | null;
  coachAudioSeconds?: number | null;
  sourceClassId: string | null;
  intensity: number | null;
  tags: string[];
  location: string | null;
  /** Nombre del lugar (Mis lugares) donde se imparte. */
  placeName?: string | null;
  /** Pistas que usa la sesión (2 = trabajo distinto en cada pista). */
  courts?: 1 | 2;
  status: "scheduled" | "completed" | "cancelled";
}

export interface SessionStudentData {
  id: string;
  name: string;
  imageUrl: string | null;
  attended: boolean | null;
  rating: number | null;
  feedback: string | null;
}

export interface SessionExerciseData {
  exerciseId: string;
  name: string;
  category: string;
  difficulty: string;
  orderIndex: number;
  durationMinutes: number;
  notes: string | null;
  coachRating: number | null;
  actualDurationSeconds: number | null;
  completedAt: string | null;
  executionNotes: string | null;
  wasSkipped: boolean;
  materials: string[];
  description?: string | null;
}

function formatDate(isoString: string, loc: string = "es-ES") {
  const date = new Date(isoString);
  const now = new Date();
  const diff = date.getTime() - now.getTime();
  const days = Math.round(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";

  return new Intl.DateTimeFormat(loc, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date);
}

function formatTime(isoString: string, loc: string = "es-ES") {
  return new Intl.DateTimeFormat(loc, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

function formatSeconds(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  if (minutes === 0) return `${rest}s`;
  if (rest === 0) return `${minutes}min`;
  return `${minutes}min ${rest}s`;
}

interface Props {
  session: SessionData;
  sessionExercises: SessionExerciseData[];
  /** Ya no se usa aquí (la edición va en /sessions/[id]/edit). */
  availableExercises?: AvailableExercise[];
  analytics: SessionAnalytics;
  students: SessionStudentData[];
  favoritedExerciseIds: string[];
  sessionBlocks: SessionBlockData[];
  isFavorite?: boolean;
  /** Esquemas de pista por id de ejercicio. */
  diagrams?: Record<string, Diagram>;
  prevHref?: string | null;
  nextHref?: string | null;
  navPosition?: number | null;
  navTotal?: number | null;
  backToSearchHref?: string | null;
  /** false cuando se ve una sesión del club que no puede editar (no la
   * creó, no la imparte y no es el gestor): oculta editar/eliminar/cambiar
   * estado/repetir; duplicar sigue disponible. */
  isOwner?: boolean;
  /** Monitor que imparte la sesión, si no es quien la ve. */
  authorName?: string | null;
  /** "Enviar al club" (Modo monitor): clubes a los que se puede enviar. */
  sendClubs?: { id: string; name: string }[];
}

export interface SessionBlockData {
  id: string;
  orderIndex: number;
  title: string | null;
  notes: string | null;
  /** Dos pistas con rotación: los minutos son por grupo. */
  rotates?: boolean;
  items: Array<{
    id: string;
    orderIndex: number;
    exerciseId: string | null;
    exerciseName: string | null;
    exerciseDescription: string | null;
    freeText: string | null;
    title: string | null;
    durationMinutes: number | null;
    notes: string | null;
    kind?: "exercise" | "text" | "warmup" | "stations";
    stations?: Array<{
      kind: "exercise" | "text";
      exerciseId: string | null;
      exerciseName: string | null;
      freeText: string | null;
      durationMinutes: number | null;
    }>;
    /** Aspecto del juego (técnica/táctica/física/mental) para items sin
     * ejercicio de biblioteca, elegido al crear el texto libre. */
    aspectoJuego?: string | null;
    /** Pista (1 o 2) y quién lo dirige; solo cuenta con courts = 2. */
    court?: number;
    ledBy?: string | null;
    turnMinutes?: number | null;
    turnSize?: number | null;
    /** Comentario del monitor sobre este ejercicio/actividad. */
    coachComment?: string | null;
    /** Nota de voz sobre este ejercicio (URL firmada; solo el dueño). */
    coachAudioUrl?: string | null;
    coachAudioSeconds?: number | null;
  }>;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .map((p) => p.charAt(0))
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function StudentsSection({
  students,
  sessionId,
  isOwner = true,
}: {
  students: SessionStudentData[];
  sessionId: string;
  isOwner?: boolean;
}) {
  const tx = useTranslations("ui.s_id_sessiondetailclient");
  const [attendance, setAttendance] = useState<Record<string, boolean | null>>(
    () => Object.fromEntries(students.map((s) => [s.id, s.attended]))
  );
  const [ratings, setRatings] = useState<Record<string, number | null>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.rating]))
  );
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.feedback ?? ""]))
  );
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<string | null>(null);

  async function toggleAttendance(studentId: string) {
    if (!isOwner) return;
    const current = attendance[studentId];
    const next = current === true ? false : true;
    setSaving(studentId);
    const res = await fetch(`/api/sessions/${sessionId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, attended: next }),
    });
    if (res.ok) setAttendance((prev) => ({ ...prev, [studentId]: next }));
    setSaving(null);
  }

  async function setRating(studentId: string, rating: number) {
    if (!isOwner) return;
    const next = ratings[studentId] === rating ? null : rating;
    setRatings((prev) => ({ ...prev, [studentId]: next }));
    await fetch(`/api/sessions/${sessionId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, rating: next }),
    });
  }

  async function commitFeedback(studentId: string) {
    if (!isOwner) return;
    const value = feedbacks[studentId] ?? "";
    await fetch(`/api/sessions/${sessionId}/attendance`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, feedback: value || null }),
    });
  }

  const presentCount = Object.values(attendance).filter(Boolean).length;

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
        <h2 className="font-semibold text-sm text-foreground">{tx("paseDeLista")}</h2>
        {students.length > 0 && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {tx("v1V2Presentes", { v1: presentCount, v2: students.length })}</span>
        )}
      </div>
      <div className="divide-y divide-border/50">
        {students.length === 0 ? (
          <p className="px-6 py-4 text-xs text-muted-foreground">
            {tx("sinAlumnosAsignados")}
          </p>
        ) : (
          students.map((s) => {
            const attended = attendance[s.id];
            const rating = ratings[s.id];
            const feedback = feedbacks[s.id] ?? "";
            const isSaving = saving === s.id;
            const isOpen = expanded[s.id];
            const hasNotes = (rating ?? 0) > 0 || feedback.trim().length > 0;
            return (
              <div key={s.id}>
                <div className="flex items-center gap-3 px-6 py-3">
                  {s.imageUrl ? (
                    <Image
                      src={s.imageUrl}
                      alt={s.name}
                      width={32}
                      height={32}
                      className="size-8 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <span className="size-8 rounded-full bg-brand/20 text-brand text-[11px] font-bold flex items-center justify-center shrink-0">
                      {getInitials(s.name)}
                    </span>
                  )}
                  <span className="flex-1 text-sm font-medium text-foreground truncate">
                    {s.name}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setExpanded((prev) => ({ ...prev, [s.id]: !prev[s.id] }))
                    }
                    className={cn(
                      "text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors",
                      hasNotes
                        ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
                        : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {hasNotes ? "★ Notas" : "Notas"}
                  </button>
                  <button
                    onClick={() => toggleAttendance(s.id)}
                    disabled={isSaving || !isOwner}
                    aria-label={attended ? "Marcar ausente" : "Marcar presente"}
                    className={cn(
                      "inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-all active:scale-95 disabled:opacity-50 min-w-[90px] justify-center",
                      attended === true
                        ? "bg-brand/10 border-brand/30 text-brand"
                        : attended === false
                          ? "bg-destructive/10 border-destructive/30 text-destructive"
                          : "bg-muted border-border text-muted-foreground hover:bg-muted/80"
                    )}
                  >
                    {isSaving ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : attended === true ? (
                      <>
                        <CheckCircle2 className="size-3" />{" "}{tx("presente")}
                      </>
                    ) : attended === false ? (
                      <>
                        <XCircle className="size-3" />{" "}{tx("ausente")}
                      </>
                    ) : (
                      <>
                        <Circle className="size-3" />{" "}{tx("sinMarcar")}
                      </>
                    )}
                  </button>
                </div>
                {isOpen && (
                  <div className="px-6 pb-4 pl-[60px] space-y-2 bg-muted/20">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setRating(s.id, n)}
                          disabled={!isOwner}
                          className={cn(
                            "size-7 flex items-center justify-center transition-colors disabled:cursor-default",
                            (rating ?? 0) >= n
                              ? "text-amber-500"
                              : "text-muted-foreground/40",
                            isOwner && "hover:text-amber-500/60"
                          )}
                          aria-label={`Valorar ${n} estrellas`}
                        >
                          <span className="text-base">★</span>
                        </button>
                      ))}
                      {rating != null && (
                        <span className="ml-2 text-[11px] text-muted-foreground">
                          {rating}/5
                        </span>
                      )}
                    </div>
                    <textarea
                      rows={2}
                      maxLength={2000}
                      value={feedback}
                      onChange={(e) =>
                        setFeedbacks((prev) => ({
                          ...prev,
                          [s.id]: e.target.value,
                        }))
                      }
                      onBlur={() => commitFeedback(s.id)}
                      readOnly={!isOwner}
                      placeholder={tx("observacionesDelAlumno")}
                      className="w-full px-3 py-2 text-xs bg-background border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-brand/40 text-foreground placeholder:text-muted-foreground resize-none disabled:opacity-60"
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function SessionDetailClient({
  session,
  sessionExercises,
  analytics,
  students,
  sessionBlocks,
  isFavorite = false,
  diagrams,
  prevHref = null,
  nextHref = null,
  navPosition = null,
  navTotal = null,
  backToSearchHref = null,
  isOwner = true,
  authorName = null,
  sendClubs = [],
}: Props) {
  const tx = useTranslations("ui.s_id_sessiondetailclient");
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const term = useTerm();
  const router = useRouter();
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  // Mueve la sesión al club: pasa a ser una sesión del club que imparte él
  // (la sigue viendo en su espacio). No se duplica.
  async function sendToClub(club: { id: string; name: string }) {
    setSendingTo(club.id);
    try {
      const res = await fetch(`/api/sessions/${session.id}/send-to-club`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clubId: club.id }),
      });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(json.error ?? tx("noSePudoEnviar"));
        return;
      }
      toast.success(tx("sesionEnviadaAV1", { v1: club.name }));
      router.refresh();
    } finally {
      setSendingTo(null);
    }
  }
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [showDuplicate, setShowDuplicate] = useState(false);
  const [status, setStatus] = useState(session.status);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{
    kind: "complete" | "cancel";
    note: string;
  } | null>(null);
  // Cierre de la sesión (¿según lo planificado? + valoración). Al volver de
  // editar una sesión que cambió (?valorar=1) se abre en la valoración.
  const searchParams = useSearchParams();
  const [closeStep, setCloseStep] = useState<"plan" | "rating" | null>(() =>
    isOwner &&
    session.status === "completed" &&
    searchParams.get("valorar") === "1"
      ? "rating"
      : null
  );

  async function patchJson(url: string, body: Record<string, unknown>) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.ok;
  }

  async function markCompleted() {
    if (status === "completed") return true;
    return patchJson(`/api/sessions/${session.id}/status`, {
      status: "completed",
    });
  }

  async function handleCloseRate(data: SessionCloseRating | RatingAfterEdit) {
    if (!(await markCompleted())) return false;
    const ok = await patchJson(`/api/sessions/${session.id}/review`, {
      ...("afterEdit" in data
        ? {}
        : {
            planFollowed: data.planFollowed,
            planChangeReason: data.planChangeReason,
            planChangeNote: data.planChangeNote,
          }),
      coachRating: data.sessionRating,
      coachComment: data.note,
    });
    if (!ok) return false;
    setStatus("completed");
    setCloseStep(null);
    router.replace(`/sessions/${session.id}`);
    router.refresh();
    return true;
  }

  const [repeatOpen, setRepeatOpen] = useState(false);
  const [repeatDates, setRepeatDates] = useState<string[]>([""]);
  const [repeating, setRepeating] = useState(false);
  const [exerciseRatings, setExerciseRatings] = useState<
    Record<string, number>
  >(() =>
    Object.fromEntries(
      sessionExercises
        .filter((e) => e.coachRating != null)
        .map((e) => [e.exerciseId, e.coachRating!])
    )
  );
  const [savingRating, setSavingRating] = useState<string | null>(null);

  async function handleDownloadPdf() {
    setDownloadingPdf(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/pdf`);
      if (!res.ok) throw new Error("Error generando PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("content-disposition")?.match(/filename="(.+)"/)?.[1] ??
        `sesion-${session.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silencioso — el botón vuelve a su estado normal
    } finally {
      setDownloadingPdf(false);
    }
  }

  async function handleStatusChange(
    newStatus: "completed" | "cancelled" | "scheduled",
    note?: string | null
  ) {
    setUpdatingStatus(true);
    const body: Record<string, unknown> = { status: newStatus };
    if (note !== undefined) body.statusNote = note;
    const res = await fetch(`/api/sessions/${session.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setStatus(newStatus);
      router.refresh();
    }
    setUpdatingStatus(false);
  }

  async function saveSessionComment(comment: string | null) {
    try {
      const res = await fetch(`/api/sessions/${session.id}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionComment: comment }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function saveItemComment(itemId: string, comment: string | null) {
    try {
      const res = await fetch(`/api/sessions/${session.id}/comments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId, itemComment: comment }),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function uploadVoiceNote(
    blob: Blob,
    seconds: number,
    itemId?: string
  ): Promise<VoiceNoteSaved | null> {
    try {
      const form = new FormData();
      form.append("file", blob, "nota-de-voz");
      form.append("seconds", String(seconds));
      if (itemId) form.append("itemId", itemId);
      const res = await fetch(`/api/sessions/${session.id}/audio`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) return null;
      const json = (await res.json()) as {
        url?: string | null;
        seconds?: number;
      };
      return { url: json.url ?? null, seconds: json.seconds ?? seconds };
    } catch {
      return null;
    }
  }

  async function deleteVoiceNote(itemId?: string) {
    try {
      const res = await fetch(`/api/sessions/${session.id}/audio`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(itemId ? { itemId } : {}),
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async function handleRateExercise(exerciseId: string, rating: number) {
    setSavingRating(exerciseId);
    const res = await fetch(`/api/sessions/${session.id}/exercise-rating`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exerciseId, rating }),
    });
    if (res.ok) {
      setExerciseRatings((prev) => ({ ...prev, [exerciseId]: rating }));
    }
    setSavingRating(null);
  }

  const [savingAsClass, setSavingAsClass] = useState(false);
  async function handleSaveAsClass() {
    if (
      !window.confirm(
        tx("seCrearaUnaClase")
      )
    )
      return;
    setSavingAsClass(true);
    try {
      const res = await fetch(`/api/sessions/${session.id}/to-class`, {
        method: "POST",
      });
      const json = (await res.json().catch(() => ({}))) as {
        data?: { classId?: string };
        error?: string;
      };
      if (!res.ok || !json.data?.classId) {
        window.alert(json.error ?? tx("noSePudoGuardar"));
        return;
      }
      router.push(`/classes/${json.data.classId}`);
    } finally {
      setSavingAsClass(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    const res = await fetch(`/api/sessions/${session.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      setDeleteError(tx("noSePudoEliminar"));
      setDeleting(false);
      return;
    }
    router.push("/sessions");
    router.refresh();
  }

  // Minutos de cada elemento de los bloques: los propios o, si no los tiene,
  // los del ejercicio de la sesión (o 5 min por defecto en textos, descansos
  // y estaciones), igual que calcula el servidor.
  const exerciseMinutes = new Map(
    sessionExercises.map((e) => [e.exerciseId, e.durationMinutes])
  );
  const itemMinutes = (item: SessionBlockData["items"][number]) =>
    item.durationMinutes ??
    (item.kind === "exercise" || (!item.kind && item.exerciseId)
      ? ((item.exerciseId ? exerciseMinutes.get(item.exerciseId) : null) ?? 0)
      : 5);
  // Minutos de la pista más larga del bloque (lo de cada pista pasa a la
  // vez) y duración del bloque: con rotación, el doble (minutos por grupo).
  const laneLongest = (block: SessionBlockData) => {
    const byCourt = new Map<number, number>();
    for (const item of block.items) {
      const court = item.court === 2 ? 2 : 1;
      byCourt.set(court, (byCourt.get(court) ?? 0) + itemMinutes(item));
    }
    return Math.max(0, ...byCourt.values());
  };
  // Con dos pistas, el bloque se muestra en dos columnas (lo de cada pista
  // pasa a la vez); con una, una sola lista como siempre.
  const lanesOf = (block: SessionBlockData) =>
    session.courts === 2
      ? [1, 2].map((court) => {
          const items = block.items.filter(
            (item) => (item.court === 2 ? 2 : 1) === court
          );
          return {
            court,
            items,
            minutes: items.reduce((sum, item) => sum + itemMinutes(item), 0),
          };
        })
      : [{ court: 0, items: block.items, minutes: 0 }];
  const blockMinutes = (block: SessionBlockData) =>
    session.courts === 2
      ? laneLongest(block) * (block.rotates ? 2 : 1)
      : block.items.reduce((sum, item) => sum + itemMinutes(item), 0);

  return (
    <div className="min-h-full w-full space-y-6 bg-[#F4F4F1] px-4 py-8 dark:bg-[#050505] sm:px-6 md:px-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-lg border border-[#050505]/10 bg-white p-4 shadow-[0_18px_60px_rgba(5,5,5,0.06)] dark:border-white/10 dark:bg-white/[0.045] sm:flex sm:items-start sm:justify-between sm:gap-4">
        <div
          aria-hidden
          className="court-grid pointer-events-none absolute inset-0 opacity-35 dark:opacity-20"
        />
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/sessions"
            title={tx("volverATodasLas")}
            className="relative flex size-10 shrink-0 items-center justify-center rounded-full border border-border bg-[#F4F4F1] text-muted-foreground transition-colors hover:border-[#D6FF38]/70 hover:text-foreground dark:bg-[#050505]/70"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <BackToSearchLink href={backToSearchHref} className="relative" />
          <p className="relative rounded-full border border-foreground/10 bg-[#F4F4F1] px-3 py-1 text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground dark:bg-[#050505]/70">
            {tx("sesionesDeEntrenamiento")}
          </p>
          <PrevNextNav
            prevHref={prevHref}
            nextHref={nextHref}
            position={navPosition}
            total={navTotal}
            className="relative ml-1"
          />
        </div>
        <div className="relative mt-4 flex w-full flex-wrap items-center gap-2 sm:mt-0 sm:w-auto sm:shrink-0 sm:justify-end">
          {/* Dar clase: ir viendo la sesión paso a paso */}
          {isOwner && status !== "cancelled" && (
            <Link
              href={`/sessions/${session.id}/execute`}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#D6FF38] px-4 py-2 text-sm font-bold text-[#050505] transition-colors hover:bg-[#c8ef2f]"
            >
              <Play className="size-3.5" />
              <span className="hidden sm:inline">
                {status === "completed" ? tx("verEnModoClase") : "Dar clase"}
              </span>
            </Link>
          )}
          {/* Duplicar: copia completa en otra fecha, en un paso. También
              para los demás monitores del club: la copia es suya. */}
          <button
            type="button"
            onClick={() => setShowDuplicate(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-[#D6FF38]/70 hover:text-foreground dark:bg-white/[0.035]"
          >
            <Copy className="size-3.5" />
            <span className="hidden sm:inline">{tx("duplicar")}</span>
          </button>
          <SessionFavoriteToggle
            sessionId={session.id}
            sessionTitle={session.title}
            initialFavorited={isFavorite}
            variant="pill"
          />
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingPdf}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-[#D6FF38]/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[0.035]"
          >
            {downloadingPdf ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <FileDown className="size-3.5" />
            )}
            <span className="hidden sm:inline">{tx("pdf")}</span>
          </button>
          {isOwner && (
            <button
              type="button"
              onClick={handleSaveAsClass}
              disabled={savingAsClass}
              title={tx("guardarEstaSesionComo")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-[#D6FF38]/70 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white/[0.035]"
            >
              {savingAsClass ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <BookmarkPlus className="size-3.5" />
              )}
              <span className="sm:hidden">{tx("clase")}</span>
              <span className="hidden sm:inline">{tx("guardarComoClase")}</span>
            </button>
          )}
          {isOwner && (
            <Link
              href={`/sessions/${session.id}/edit`}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-[#D6FF38]/70 hover:text-foreground dark:bg-white/[0.035]"
            >
              <Pencil className="size-3.5" />
              <span className="hidden sm:inline">{tx("editar")}</span>
            </Link>
          )}
          {isOwner && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/30 bg-white/70 px-3 py-2 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10 dark:bg-white/[0.035]"
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">{tx("eliminar")}</span>
            </button>
          )}
          {sendClubs.map((club) => (
            <button
              key={club.id}
              type="button"
              onClick={() => void sendToClub(club)}
              disabled={sendingTo !== null}
              title={tx("laSesionPasaAl")}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white/70 px-3 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:border-[#D6FF38]/70 hover:text-foreground disabled:opacity-60 dark:bg-white/[0.035]"
            >
              {sendingTo === club.id ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Send className="size-3.5" />
              )}
              <span>{tx("enviarAV1", { v1: club.name })}</span>
            </button>
          ))}
          {authorName && (
            <span className="inline-flex items-center rounded-full border border-foreground/15 bg-foreground/5 px-3 py-2 text-sm font-semibold text-foreground/60">
              {tx("imparteV1", { v1: authorName })}
            </span>
          )}
        </div>
      </div>

      {/* Session card */}
      <div className="overflow-hidden rounded-lg border border-[#050505]/10 bg-white shadow-[0_18px_60px_rgba(5,5,5,0.05)] dark:border-white/10 dark:bg-white/[0.045]">
        {/* Header stripe */}
        <div className="border-b border-border/50 bg-[#050505] px-4 py-5 text-white dark:bg-white/[0.06] sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/10">
                {status === "completed" ? (
                  <CheckCircle2 className="size-5 text-brand" />
                ) : status === "cancelled" ? (
                  <XCircle className="size-5 text-destructive" />
                ) : (
                  <Circle className="size-5 text-muted-foreground/60" />
                )}
              </div>
              <div>
                <span
                  className={cn(
                    "text-xs font-bold uppercase tracking-widest",
                    status === "completed"
                      ? "text-[#D6FF38]"
                      : status === "cancelled"
                        ? "text-destructive"
                        : "text-white/60"
                  )}
                >
                  {status === "completed"
                    ? "Completada"
                    : status === "cancelled"
                      ? "Cancelada"
                      : "Programada"}
                </span>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="flex items-center gap-1 text-xs text-white/65">
                    <Calendar className="size-3" />
                    {formatDate(session.scheduledAt, intlLocale)}{" "}{tx("aLas")}{" "}
                    {formatTime(session.scheduledAt, intlLocale)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status actions */}
        {isOwner && status !== "completed" && status !== "cancelled" && (
          <div className="flex flex-wrap items-center gap-2 border-b border-border/50 px-4 py-3 sm:px-6">
            <button
              onClick={() => setCloseStep("plan")}
              disabled={updatingStatus}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-brand border border-brand/30 bg-brand/5 px-3 py-1.5 rounded-full hover:bg-brand/15 transition-colors disabled:opacity-50"
            >
              {updatingStatus ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <CheckCircle2 className="size-3" />
              )}
              {tx("sesionCompletada")}
            </button>
            <button
              onClick={() => setStatusDialog({ kind: "cancel", note: "" })}
              disabled={updatingStatus}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-destructive border border-destructive/30 bg-destructive/5 px-3 py-1.5 rounded-full hover:bg-destructive/15 transition-colors disabled:opacity-50"
            >
              <XCircle className="size-3" />
              {tx("cancelarSesion")}
            </button>
            <button
              onClick={() => setRepeatOpen(true)}
              disabled={updatingStatus}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-foreground border border-border bg-background px-3 py-1.5 rounded-full hover:bg-muted transition-colors disabled:opacity-50"
            >
              <CalendarClock className="size-3" />
              {tx("repetirEnOtrasFechas")}
            </button>
          </div>
        )}
        {isOwner && status === "cancelled" && (
          <div className="border-b border-border/50 px-4 py-3 sm:px-6">
            <button
              onClick={() => handleStatusChange("scheduled")}
              disabled={updatingStatus}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground border border-border px-3 py-1.5 rounded-full hover:bg-muted transition-colors disabled:opacity-50"
            >
              {updatingStatus ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <Circle className="size-3" />
              )}
              {tx("reprogramar")}
            </button>
          </div>
        )}

        {/* Content */}
        <div className="space-y-5 p-4 sm:p-6">
          <h1 className="font-heading text-2xl font-bold tracking-tight text-foreground leading-snug">
            {session.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="size-3.5" />
              {session.durationMinutes}{" "}{tx("min")}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Dumbbell className="size-3.5" />
              {sessionExercises.length}{" "}
              {sessionExercises.length !== 1 ? "ejercicios" : "ejercicio"}
            </span>
          </div>

          {hasSessionAnimation(session.id) && (
            <ClassAnimationButton sessionId={session.id} variant="hero" />
          )}

          <SessionInfoSummary
            objective={session.objective}
            material={session.material}
            observations={session.observations}
            tags={session.tags}
            place={session.placeName ?? session.location}
            showEmptyObjective
            className="border-t border-border/50 pt-4"
          />

          {session.description && (
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">
                {tx("descripcion")}
              </p>
              <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                {session.description}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Analytics */}
      <SessionAnalyticsView analytics={analytics} />

      {/* Students */}
      <StudentsSection
        students={students}
        sessionId={session.id}
        isOwner={isOwner}
      />

      {sessionBlocks.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-foreground">
              {tx("bloquesDeLaSesion")}
            </h2>
            <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {tx("v1Min", { v1: sessionBlocks.reduce(
                (sum, block) =>
                  sum +
                  block.items.reduce(
                    (blockSum, item) => blockSum + itemMinutes(item),
                    0
                  ),
                0
              ) })}</span>
          </div>
          <div
            className={cn(
              "grid gap-3 p-4 sm:p-5",
              session.courts === 2 ? "grid-cols-1" : "lg:grid-cols-3"
            )}
          >
            {sessionBlocks.map((block) => (
              <div
                key={block.id}
                className="rounded-lg border border-border/80 bg-background p-4"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {block.title ?? `Bloque ${block.orderIndex}`}
                  </p>
                  <span className="shrink-0 text-[11px] font-semibold tabular-nums text-foreground">
                    {tx("v1Min", { v1: blockMinutes(block) })}</span>
                </div>
                {session.courts === 2 && block.rotates && (
                  <div className="mt-2 rounded-md border border-brand/30 bg-brand/5 px-2.5 py-2 text-xs text-foreground">
                    <p className="font-bold">{tx("losGruposRotan")}</p>
                    <p>
                      {tx("ronda10V1", { v1: laneLongest(block) })}</p>
                    <p>
                      {tx("ronda2V1V2", { v1: laneLongest(block), v2: laneLongest(block) * 2 })}</p>
                  </div>
                )}
                {block.notes && (
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    {block.notes}
                  </p>
                )}
                <div className="mt-3 space-y-2">
                  {block.items.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      {tx("sinItemsDefinidos")}
                    </p>
                  ) : (
                    <div
                      className={
                        session.courts === 2
                          ? "grid gap-3 md:grid-cols-2"
                          : "space-y-2"
                      }
                    >
                      {lanesOf(block).map((lane) => (
                        <div key={lane.court} className="min-w-0 space-y-2">
                          {session.courts === 2 && (
                            <div className="flex items-center justify-between rounded-md bg-brand/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-foreground">
                              <span>{tx("pistaV1", { v1: lane.court })}</span>
                              <span className="tabular-nums">
                                {tx("v1Min", { v1: lane.minutes })}</span>
                            </div>
                          )}
                          {session.courts === 2 && lane.items.length === 0 && (
                            <p className="text-xs text-muted-foreground">
                              {tx("nadaEnEstaPista")}
                            </p>
                          )}
                          {lane.items.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-md border border-border/60 bg-muted/20 px-3 py-2"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 text-sm font-medium text-foreground">
                                  {item.kind === "warmup" ? (
                                    "Descanso"
                                  ) : item.kind === "stations" ? (
                                    `Estaciones (${item.stations?.length ?? 0})`
                                  ) : item.exerciseId && item.exerciseName ? (
                                    <Link
                                      href={`/exercises/${item.exerciseId}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="hover:text-brand hover:underline"
                                    >
                                      {item.exerciseName}
                                    </Link>
                                  ) : (
                                    item.title ||
                                    item.exerciseName ||
                                    item.freeText ||
                                    "Texto libre"
                                  )}
                                  {!item.exerciseId &&
                                    item.kind !== "warmup" &&
                                    item.kind !== "stations" &&
                                    item.aspectoJuego && (
                                      <span className="ml-2 inline-flex items-center rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground align-middle">
                                        {ASPECTO_JUEGO_LABELS[
                                          item.aspectoJuego as keyof typeof ASPECTO_JUEGO_LABELS
                                        ] ?? item.aspectoJuego}
                                      </span>
                                    )}
                                  {session.courts === 2 && (
                                    <span className="ml-2 inline-flex items-center gap-1 align-middle">
                                      <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand">
                                        {tx("pistaV1", { v1: item.court === 2 ? 2 : 1 })}
                                      </span>
                                      {(item.ledBy === "coach" ||
                                        item.ledBy === "auto") && (
                                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                          {item.ledBy === "coach"
                                            ? "Con monitor"
                                            : "Autónomo"}
                                        </span>
                                      )}
                                      {(item.turnMinutes ?? 0) > 0 && (
                                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                                          {tx("porTurnosV1Min", { v1: item.turnMinutes ?? 0, v2: (item.turnSize ?? 1) > 1
                                            ? tx("turnSizeSuffixComma", { n: item.turnSize ?? 1 })
                                            : "" })}
                                        </span>
                                      )}
                                    </span>
                                  )}
                                </div>
                                <span className="flex shrink-0 items-center gap-1 text-[11px] font-semibold tabular-nums text-muted-foreground">
                                  <Clock className="size-3" />
                                  {itemMinutes(item)}{" "}{tx("min")}
                                  {item.kind === "stations" ? tx("enTotal") : ""}
                                </span>
                              </div>
                              {item.kind === "stations" && (
                                <>
                                  {item.freeText && (
                                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                      {item.freeText}
                                    </p>
                                  )}
                                  <ul className="mt-2 space-y-1">
                                    {(item.stations ?? []).map(
                                      (station, idx) => (
                                        <li
                                          key={idx}
                                          className="text-xs text-muted-foreground"
                                        >
                                          {idx + 1}.{" "}
                                          {station.kind === "exercise" &&
                                          station.exerciseId ? (
                                            <Link
                                              href={`/exercises/${station.exerciseId}`}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-foreground hover:text-brand hover:underline"
                                            >
                                              {station.exerciseName ??
                                                "Ejercicio"}
                                            </Link>
                                          ) : (
                                            (station.freeText ??
                                            station.exerciseName)
                                          )}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                </>
                              )}
                              {item.kind !== "stations" &&
                                item.kind !== "warmup" &&
                                !item.exerciseId &&
                                item.title &&
                                item.freeText && (
                                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                    {item.freeText}
                                  </p>
                                )}
                              {item.exerciseDescription && (
                                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                                  {item.exerciseDescription}
                                </p>
                              )}
                              {item.notes && (
                                <p className="mt-1 text-[11px] text-muted-foreground">
                                  {item.notes}
                                </p>
                              )}
                              {item.kind !== "warmup" && (
                                <div className="mt-2 space-y-2">
                                  <SessionCommentBox
                                    value={item.coachComment}
                                    readOnly={!isOwner}
                                    onSave={(comment) =>
                                      saveItemComment(item.id, comment)
                                    }
                                    placeholder={tx("comoHaIdoEste")}
                                  />
                                  <SessionVoiceNote
                                    url={item.coachAudioUrl}
                                    seconds={item.coachAudioSeconds}
                                    readOnly={!isOwner}
                                    onUpload={(blob, seconds) =>
                                      uploadVoiceNote(blob, seconds, item.id)
                                    }
                                    onDelete={() => deleteVoiceNote(item.id)}
                                  />
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Comentarios generales de la sesión (antes o después de completarla) */}
      {(isOwner || session.coachComment?.trim() || session.coachRating) && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-sm text-foreground">
                {tx("comentariosDeLaSesion")}
              </h2>
              {session.coachRating ? (
                <div
                  className="flex items-center gap-0.5"
                  role="img"
                  aria-label={tx("valoracionDeLaClase", { v1: session.coachRating })}
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn(
                        "size-4",
                        n <= (session.coachRating ?? 0)
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      )}
                    />
                  ))}
                </div>
              ) : isOwner && status === "completed" ? (
                <button
                  type="button"
                  onClick={() => setCloseStep("rating")}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-[11px] font-semibold text-foreground hover:bg-amber-500/20"
                >
                  <Star className="size-3 fill-amber-400 text-amber-400" />
                  {tx("faltaLaValoracion")}
                </button>
              ) : null}
            </div>
            {session.planFollowed != null && (
              <p className="mt-1.5">
                <span
                  className={cn(
                    "inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium text-foreground",
                    session.planFollowed ? "bg-brand/15" : "bg-amber-500/15"
                  )}
                >
                  {session.planFollowed
                    ? tx("segunLoPlanificado")
                    : tx("cambioRespectoAlPlan", { v1: planChangeReasonLabel(session.planChangeReason)
                          ? ` · ${planChangeReasonLabel(session.planChangeReason)}`
                          : "", v2: session.planChangeReason === "otro" &&
                        session.statusNote
                          ? `: ${session.statusNote}`
                          : "" })}
                </span>
              </p>
            )}
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              {tx("anotaComoHaIdo")}
            </p>
          </div>
          <div className="p-4 sm:p-5">
            <SessionCommentBox
              value={session.coachComment}
              readOnly={!isOwner}
              onSave={saveSessionComment}
              alwaysOpen
              addLabel="Comentarios de la sesión"
              placeholder={tx("ritmoDelGrupoQue")}
              maxLength={4000}
            />
            <SessionVoiceNote
              url={session.coachAudioUrl}
              seconds={session.coachAudioSeconds}
              readOnly={!isOwner}
              onUpload={(blob, seconds) => uploadVoiceNote(blob, seconds)}
              onDelete={() => deleteVoiceNote()}
              addLabel="Grabar nota de voz de la sesión"
              className="mt-3"
            />
          </div>
        </div>
      )}

      {/* Materials summary */}
      {(() => {
        const allMaterials = Array.from(
          new Set(sessionExercises.flatMap((e) => e.materials ?? []))
        );
        if (allMaterials.length === 0) return null;
        return (
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
              <Package className="size-4 text-brand" />
              <h2 className="font-semibold text-sm text-foreground">
                {tx("materialNecesario")}
              </h2>
              <span className="ml-auto text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {tx("v1ElementoV2", { v1: allMaterials.length, v2: allMaterials.length !== 1 ? "s" : "" })}
              </span>
            </div>
            <div className="px-6 py-4 flex flex-wrap gap-2">
              {allMaterials.map((m) => (
                <span
                  key={m}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold bg-brand/10 text-brand border border-brand/15 px-3 py-1.5 rounded-full"
                >
                  <Package className="size-3 opacity-70" />
                  {m}
                </span>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Exercises list */}
      {sessionExercises.length > 0 && (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
            <h2 className="font-semibold text-sm text-foreground">
              {tx("ejercicios")}
            </h2>
            {status === "completed" && (
              <p className="text-[10px] text-muted-foreground">
                {tx("valoracionPostSesion")}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-3 p-4 sm:p-5">
            {sessionExercises.map((ex, idx) => {
              const diff = DIFFICULTY_META[ex.difficulty];
              const currentRating = exerciseRatings[ex.exerciseId] ?? 0;
              const isSaving = savingRating === ex.exerciseId;
              return (
                <div
                  key={ex.exerciseId}
                  className="rounded-lg border border-border/80 bg-background px-4 py-4 shadow-sm transition-colors hover:border-brand/30"
                >
                  <div className="flex items-start gap-4">
                    <span className="text-xs font-mono text-muted-foreground/60 w-5 shrink-0 text-right mt-0.5">
                      {idx + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/exercises/${ex.exerciseId}`}
                        className="text-sm font-medium text-foreground hover:text-brand transition-colors"
                      >
                        {ex.name}
                      </Link>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span
                          className={cn(
                            "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                            CATEGORY_COLORS[ex.category] ??
                              "text-muted-foreground bg-muted"
                          )}
                        >
                          {term(CATEGORY_LABELS[ex.category] ?? ex.category)}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] font-medium",
                            diff?.color ?? "text-muted-foreground"
                          )}
                        >
                          {term(diff?.label ?? ex.difficulty)}
                        </span>
                      </div>
                      {ex.description && (
                        <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                          {ex.description}
                        </p>
                      )}
                      {ex.materials && ex.materials.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {ex.materials.map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground bg-muted/60 border border-border/60 px-2 py-0.5 rounded-full"
                            >
                              <Package className="size-2.5 opacity-60" />
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                      {diagrams?.[ex.exerciseId] && (
                        <ExerciseDiagramView
                          diagram={diagrams[ex.exerciseId]}
                          className="mt-3"
                          maxWidth={260}
                        />
                      )}
                      {ex.notes && (
                        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed italic">
                          {ex.notes}
                        </p>
                      )}
                      {(ex.completedAt ||
                        (ex.actualDurationSeconds ?? 0) > 0 ||
                        ex.executionNotes ||
                        ex.wasSkipped) && (
                        <div className="mt-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                            {ex.wasSkipped ? (
                              <span className="inline-flex items-center gap-1 font-medium text-amber-500">
                                <XCircle className="size-3" />
                                {tx("saltado")}
                              </span>
                            ) : ex.completedAt ? (
                              <span className="inline-flex items-center gap-1 font-medium text-brand">
                                <CheckCircle2 className="size-3" />
                                {tx("ejecutado")}
                              </span>
                            ) : null}
                            {(ex.actualDurationSeconds ?? 0) > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <Clock className="size-3" />
                                {tx("real")}{" "}
                                {formatSeconds(ex.actualDurationSeconds ?? 0)}
                              </span>
                            )}
                          </div>
                          {ex.executionNotes && (
                            <p className="mt-1.5 text-xs leading-relaxed text-foreground/65">
                              {ex.executionNotes}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        <Clock className="size-3" />
                        {ex.durationMinutes}{" "}{tx("min")}
                      </span>
                      {status === "completed" && (
                        <div
                          className="flex items-center gap-0.5"
                          title={tx("valorarEjercicio")}
                        >
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              onClick={() =>
                                handleRateExercise(ex.exerciseId, star)
                              }
                              disabled={isSaving}
                              aria-label={`Valorar con ${star} estrellas`}
                              className={cn(
                                "p-0.5 transition-colors disabled:opacity-50 touch-manipulation",
                                star <= currentRating
                                  ? "text-amber-400"
                                  : "text-muted-foreground/25 hover:text-amber-400/60"
                              )}
                            >
                              <Star className="size-4 fill-current" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !deleting && setShowDeleteConfirm(false)}
          />
          <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl">
            <div className="flex items-start gap-4 mb-5">
              <div className="size-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="size-5 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">
                  {tx("eliminarSesion")}
                </h3>
                <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                  {tx("seguroQueQuieresEliminar")}{" "}
                  <span className="font-medium text-foreground">
                    {session.title}
                  </span>
                  {tx("questionCannotUndo")}
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
                {tx("cancelar")}
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-destructive text-destructive-foreground text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-destructive/90 active:scale-95 transition-all duration-150 disabled:opacity-60"
              >
                {deleting && <Loader2 className="size-4 animate-spin" />}
                {tx("eliminar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDuplicate && (
        <SessionDateDialog
          mode="duplicate"
          session={{
            id: session.id,
            title: session.title,
            scheduledAt: session.scheduledAt,
          }}
          open
          onOpenChange={(open) => {
            if (!open) setShowDuplicate(false);
          }}
          onDone={(result) => {
            router.push(`/sessions/${result.id}`);
            router.refresh();
          }}
        />
      )}

      <SessionCloseDialog
        key={closeStep ?? "closed"}
        open={closeStep !== null}
        initialStep={closeStep ?? "plan"}
        initialNote={session.coachComment ?? ""}
        onClose={() => {
          setCloseStep(null);
          if (searchParams.get("valorar")) {
            router.replace(`/sessions/${session.id}`);
          }
        }}
        onRate={handleCloseRate}
      />

      {/* Status note dialog */}
      {statusDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={() => setStatusDialog(null)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-xl text-foreground">
              {statusDialog.kind === "complete"
                ? tx("marcarComoCompletada")
                : "Cancelar sesión"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {statusDialog.kind === "complete"
                ? tx("anotaComoFueLa")
                : tx("indicaElMotivoDe")}
            </p>
            <textarea
              autoFocus
              rows={4}
              maxLength={2000}
              value={statusDialog.note}
              onChange={(e) =>
                setStatusDialog({ ...statusDialog, note: e.target.value })
              }
              placeholder={
                statusDialog.kind === "complete"
                  ? tx("buenRitmoLosAlumnos")
                  : tx("lluviaLesionAusenciaDel")
              }
              className="w-full px-3 py-2.5 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand/50 text-foreground placeholder:text-muted-foreground resize-none"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStatusDialog(null)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground px-4 py-2"
              >
                {tx("cancelar")}
              </button>
              <button
                type="button"
                disabled={updatingStatus}
                onClick={async () => {
                  const targetStatus =
                    statusDialog.kind === "complete"
                      ? "completed"
                      : "cancelled";
                  await handleStatusChange(
                    targetStatus,
                    statusDialog.note.trim() || null
                  );
                  setStatusDialog(null);
                }}
                className={cn(
                  "inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-xl text-brand-foreground transition-colors disabled:opacity-60",
                  statusDialog.kind === "complete"
                    ? "bg-brand hover:bg-brand/90"
                    : "bg-destructive hover:bg-destructive/90 text-white"
                )}
              >
                {updatingStatus && <Loader2 className="size-4 animate-spin" />}
                {tx("confirmar")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Repeat dialog */}
      {repeatOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4"
          onClick={() => setRepeatOpen(false)}
        >
          <div
            className="bg-card border border-border rounded-2xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-xl text-foreground">
              {tx("repetirSesion")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {tx("cloneDescription")}
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {repeatDates.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="datetime-local"
                    value={d}
                    onChange={(e) =>
                      setRepeatDates((prev) =>
                        prev.map((v, j) => (j === i ? e.target.value : v))
                      )
                    }
                    className="flex-1 h-10 px-3 text-sm bg-background border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/40 text-foreground"
                  />
                  {repeatDates.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setRepeatDates((prev) => prev.filter((_, j) => j !== i))
                      }
                      className="size-10 rounded-xl border border-border flex items-center justify-center text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={tx("quitarFecha")}
                    >
                      <X className="size-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => setRepeatDates((prev) => [...prev, ""])}
                className="text-xs font-semibold text-brand hover:underline"
              >
                {tx("anadirFecha")}
              </button>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRepeatOpen(false)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground px-4 py-2"
              >
                {tx("cancelar")}
              </button>
              <button
                type="button"
                disabled={repeating}
                onClick={async () => {
                  const validDates = repeatDates
                    .filter((d) => d.trim())
                    .map((d) => new Date(d).toISOString());
                  if (validDates.length === 0) return;
                  setRepeating(true);
                  const res = await fetch(
                    `/api/sessions/${session.id}/repeat`,
                    {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ dates: validDates }),
                    }
                  );
                  setRepeating(false);
                  if (res.ok) {
                    setRepeatOpen(false);
                    setRepeatDates([""]);
                    router.push("/sessions");
                    router.refresh();
                  }
                }}
                className="inline-flex items-center gap-2 bg-brand text-brand-foreground text-sm font-semibold px-4 py-2 rounded-xl hover:bg-brand/90 transition-colors disabled:opacity-60"
              >
                {repeating && <Loader2 className="size-4 animate-spin" />}
                {tx("crearSesiones")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
