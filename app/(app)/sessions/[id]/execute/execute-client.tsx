"use client";

import { ExerciseDiagramView } from "@/components/app/exercise-diagram";
import type { Diagram } from "@/lib/exercise-diagrams/types";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  CheckCircle2,
  Clock,
  X,
  Play,
  Pause,
  SkipForward,
  Flag,
  Loader2,
  RotateCcw,
  Package,
  Timer,
  Dumbbell,
  ListOrdered,
  Check,
  Star,
} from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  technique: "border-blue-500/40 bg-blue-500/5",
  tactics: "border-purple-500/40 bg-purple-500/5",
  fitness: "border-amber-500/40 bg-amber-500/5",
  "warm-up": "border-brand/40 bg-brand/5",
  warmup: "border-sky-500/40 bg-sky-500/5",
  stations: "border-emerald-500/40 bg-emerald-500/5",
};

const CATEGORY_ACCENT: Record<string, string> = {
  technique: "text-blue-400",
  tactics: "text-purple-400",
  fitness: "text-amber-400",
  "warm-up": "text-brand",
  warmup: "text-sky-400",
  stations: "text-emerald-400",
};

const CATEGORY_LABELS: Record<string, string> = {
  technique: "Técnica",
  tactics: "Táctica",
  fitness: "Fitness",
  "warm-up": "Calentamiento",
  warmup: "Descanso",
  stations: "Estaciones",
};

const CATEGORY_BAR: Record<string, string> = {
  technique: "bg-blue-400",
  tactics: "bg-purple-400",
  fitness: "bg-amber-400",
  "warm-up": "bg-brand",
  warmup: "bg-sky-400",
  stations: "bg-emerald-400",
};

interface ExerciseData {
  /** Clave única del elemento del plan. */
  key: string;
  /** "text" = texto libre del monitor (no es un ejercicio de la biblioteca). */
  kind: "exercise" | "text";
  exerciseId: string | null;
  name: string;
  category: string;
  difficulty: string;
  description: string | null;
  durationMinutes: number;
  notes: string | null;
  orderIndex: number;
  steps: Array<{ title: string; description: string }>;
  tips: string | null;
  materials: string[];
}

interface SessionData {
  id: string;
  title: string;
  durationMinutes: number;
  scheduledAt: string;
  status: string;
  coachRating?: number | null;
  coachComment?: string | null;
}

interface StudentData {
  id: string;
  name: string;
  attended: boolean | null;
  rating: number | null;
}

interface Props {
  session: SessionData;
  exercises: ExerciseData[];
  students?: StudentData[];
  diagrams?: Record<string, Diagram>;
}

type ExerciseExecution = {
  actualDurationSeconds: number;
  completed: boolean;
  skipped: boolean;
  rating: number | null;
  notes: string;
};

function StarRating({
  value,
  onChange,
  label,
  size = "lg",
  allowClear = false,
}: {
  value: number;
  onChange: (next: number) => void;
  label: string;
  size?: "lg" | "sm";
  allowClear?: boolean;
}) {
  return (
    <div
      className="flex items-center gap-1"
      role="radiogroup"
      aria-label={label}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} de 5`}
          onClick={() => onChange(allowClear && value === n ? 0 : n)}
          className="rounded-md p-0.5 transition-transform active:scale-90"
        >
          <Star
            className={cn(
              size === "lg" ? "size-9" : "size-6",
              n <= value
                ? "fill-amber-400 text-amber-400"
                : "text-muted-foreground/35"
            )}
          />
        </button>
      ))}
    </div>
  );
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function formatDate(isoString: string) {
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

export function ExecuteSessionClient({
  session,
  exercises,
  students = [],
  diagrams,
}: Props) {
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const [countdownMode, setCountdownMode] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [showFinish, setShowFinish] = useState(false);
  const [showQuickComplete, setShowQuickComplete] = useState(false);
  const [showRoadmap, setShowRoadmap] = useState(false);
  const [finishError, setFinishError] = useState<string | null>(null);
  // Pasar lista antes de empezar: por defecto todos presentes (salvo lo ya
  // guardado), y el monitor marca a quien falta.
  const [attendanceStage, setAttendanceStage] = useState(false);
  const [attendance, setAttendance] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(students.map((s) => [s.id, s.attended ?? true]))
  );
  const [savingAttendance, setSavingAttendance] = useState(false);
  const [attendanceError, setAttendanceError] = useState<string | null>(null);
  // Valoración al terminar: estrellas de la clase (obligatoria), comentario y
  // estrellas por alumno (opcionales).
  const [sessionRating, setSessionRating] = useState(
    session.coachRating ?? 0
  );
  const [sessionComment, setSessionComment] = useState(
    session.coachComment ?? ""
  );
  const [studentRatings, setStudentRatings] = useState<Record<string, number>>(
    () =>
      Object.fromEntries(
        students.filter((s) => s.rating).map((s) => [s.id, s.rating as number])
      )
  );
  const [executionById, setExecutionById] = useState<
    Record<string, ExerciseExecution>
  >({});

  const current = exercises[currentIdx];
  const totalExercises = exercises.length;
  const progress = totalExercises > 0 ? (done.size / totalExercises) * 100 : 0;

  const allMaterials = Array.from(
    new Set(exercises.flatMap((e) => e.materials ?? []))
  );

  // Al empezar la sesión y al cambiar de ejercicio, subir siempre al título
  const exerciseTopRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!started) return;
    const frame = requestAnimationFrame(() => {
      exerciseTopRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [started, currentIdx]);

  useEffect(() => {
    if (!timerRunning) return;
    const interval = setInterval(() => {
      setTimerSeconds((t) => {
        if (countdownMode && t <= 0) {
          setTimerRunning(false);
          return 0;
        }
        return countdownMode ? t - 1 : t + 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [timerRunning, countdownMode]);

  function resetTimerForExercise(exercise = current) {
    setTimerRunning(false);
    if (countdownMode && exercise) {
      setTimerSeconds((exercise.durationMinutes ?? 0) * 60);
    } else {
      setTimerSeconds(0);
    }
  }

  function beginSession() {
    resetTimerForExercise(current);
    setStarted(true);
  }

  function handleStart() {
    // Lo primero es pasar lista (si la sesión tiene alumnos).
    if (students.length > 0) {
      setAttendanceStage(true);
      return;
    }
    beginSession();
  }

  async function confirmAttendance() {
    setSavingAttendance(true);
    setAttendanceError(null);
    try {
      const results = await Promise.all(
        students.map((student) =>
          fetch(`/api/sessions/${session.id}/attendance`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: student.id,
              attended: attendance[student.id] ?? true,
            }),
          })
        )
      );
      if (results.some((r) => !r.ok)) throw new Error("attendance");
    } catch {
      setSavingAttendance(false);
      setAttendanceError(
        "No se pudo guardar la lista. Revisa la conexión e inténtalo de nuevo."
      );
      return;
    }
    setSavingAttendance(false);
    setAttendanceStage(false);
    beginSession();
  }

  function toggleCountdown() {
    const next = !countdownMode;
    setCountdownMode(next);
    setTimerRunning(false);
    if (next && current) {
      setTimerSeconds((current.durationMinutes ?? 0) * 60);
    } else {
      setTimerSeconds(0);
    }
  }

  function markDone(key: string) {
    setDone((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  }

  function elapsedSecondsFor(exercise = current) {
    if (!exercise) return 0;
    if (!countdownMode) return timerSeconds;
    return Math.max(exercise.durationMinutes * 60 - timerSeconds, 0);
  }

  function updateExecution(key: string, patch: Partial<ExerciseExecution>) {
    setExecutionById((prev) => {
      const currentEntry = prev[key] ?? {
        actualDurationSeconds: 0,
        completed: false,
        skipped: false,
        rating: null,
        notes: "",
      };
      return {
        ...prev,
        [key]: { ...currentEntry, ...patch },
      };
    });
  }

  function recordCurrent({
    completed,
    skipped = false,
  }: {
    completed: boolean;
    skipped?: boolean;
  }) {
    if (!current) return;
    updateExecution(current.key, {
      actualDurationSeconds: elapsedSecondsFor(current),
      completed,
      skipped,
    });
    if (completed) markDone(current.key);
  }

  function goNext() {
    recordCurrent({ completed: true });
    if (currentIdx < totalExercises - 1) {
      const nextIdx = currentIdx + 1;
      resetTimerForExercise(exercises[nextIdx]);
      setCurrentIdx(nextIdx);
    } else {
      setShowFinish(true);
    }
  }

  function skipCurrent() {
    recordCurrent({ completed: true, skipped: true });
    if (currentIdx < totalExercises - 1) {
      const nextIdx = currentIdx + 1;
      resetTimerForExercise(exercises[nextIdx]);
      setCurrentIdx(nextIdx);
    } else {
      setShowFinish(true);
    }
  }

  function goPrev() {
    if (currentIdx > 0) {
      const nextIdx = currentIdx - 1;
      resetTimerForExercise(exercises[nextIdx]);
      setCurrentIdx(nextIdx);
    }
  }

  function selectExercise(idx: number) {
    resetTimerForExercise(exercises[idx]);
    setCurrentIdx(idx);
  }

  async function handleFinish({ markAll = false }: { markAll?: boolean } = {}) {
    if (sessionRating < 1) {
      setFinishError("Valora la clase de 1 a 5 estrellas para terminar.");
      return;
    }
    setFinishing(true);
    setFinishError(null);

    // Valoración de la clase y, si se han puesto, de cada alumno.
    try {
      const reviewResults = await Promise.all([
        fetch(`/api/sessions/${session.id}/review`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            coachRating: sessionRating,
            coachComment: sessionComment.trim() || null,
          }),
        }),
        ...students
          .filter((student) => (studentRatings[student.id] ?? 0) > 0)
          .map((student) =>
            fetch(`/api/sessions/${session.id}/attendance`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                studentId: student.id,
                rating: studentRatings[student.id],
              }),
            })
          ),
      ]);
      if (reviewResults.some((r) => !r.ok)) throw new Error("review");
    } catch {
      setFinishing(false);
      setFinishError(
        "No se pudo guardar la valoración. Revisa la conexión e inténtalo de nuevo."
      );
      return;
    }

    const currentElapsed = current ? elapsedSecondsFor(current) : 0;
    const payload = exercises
      .filter((exercise) => exercise.kind === "exercise" && exercise.exerciseId)
      .map((exercise) => {
        const existing = executionById[exercise.key];
        const isCurrent = current?.key === exercise.key;
        const completed =
          markAll ||
          done.has(exercise.key) ||
          (started && isCurrent) ||
          existing?.completed;
        return {
          exerciseId: exercise.exerciseId as string,
          actualDurationSeconds:
            started && isCurrent
              ? currentElapsed
              : (existing?.actualDurationSeconds ?? 0),
          completed: Boolean(completed),
          skipped: existing?.skipped ?? false,
          rating: existing?.rating ?? null,
          notes: existing?.notes ?? null,
        };
      });

    // Sesión solo con textos libres: basta con marcarla como completada.
    const res =
      payload.length > 0
        ? await fetch(`/api/sessions/${session.id}/execution`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ exercises: payload, completeSession: true }),
          })
        : await fetch(`/api/sessions/${session.id}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "completed" }),
          });
    if (!res.ok) {
      setFinishing(false);
      setFinishError(
        "No se pudo guardar. Revisa la conexión e inténtalo de nuevo."
      );
      return;
    }
    router.push(`/sessions/${session.id}`);
    router.refresh();
  }

  const reviewStudents = students.filter((s) => attendance[s.id] !== false);

  const reviewFields = (
    <div className="mb-5 space-y-4 text-left">
      <div className="text-center">
        <p className="text-sm font-black text-foreground">
          ¿Qué tal ha ido la clase?{" "}
          <span className="text-destructive" aria-hidden>
            *
          </span>
        </p>
        <div className="mt-2 flex justify-center">
          <StarRating
            value={sessionRating}
            onChange={setSessionRating}
            label="Valoración de la clase de 1 a 5 estrellas"
          />
        </div>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Obligatoria: de 1 a 5 estrellas
        </p>
      </div>
      <label className="block">
        <span className="text-xs font-black text-foreground">
          Comentario <span className="font-semibold text-muted-foreground">(opcional)</span>
        </span>
        <textarea
          value={sessionComment}
          onChange={(e) => setSessionComment(e.target.value)}
          rows={3}
          maxLength={2000}
          placeholder="Qué ha funcionado, qué cambiarías, incidencias…"
          className="mt-1 w-full resize-none rounded-2xl border border-[#050505]/10 bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand/40 dark:border-white/10"
        />
      </label>
      {reviewStudents.length > 0 && (
        <details className="rounded-2xl border border-[#050505]/10 dark:border-white/10">
          <summary className="cursor-pointer px-3 py-2.5 text-xs font-black text-foreground">
            Valorar alumnos{" "}
            <span className="font-semibold text-muted-foreground">(opcional)</span>
          </summary>
          <ul className="divide-y divide-[#050505]/10 border-t border-[#050505]/10 dark:divide-white/10 dark:border-white/10">
            {reviewStudents.map((student) => (
              <li
                key={student.id}
                className="flex items-center justify-between gap-2 px-3 py-2"
              >
                <span className="min-w-0 truncate text-sm font-semibold text-foreground">
                  {student.name}
                </span>
                <StarRating
                  size="sm"
                  allowClear
                  value={studentRatings[student.id] ?? 0}
                  onChange={(next) =>
                    setStudentRatings((prev) => ({
                      ...prev,
                      [student.id]: next,
                    }))
                  }
                  label={`Valoración de ${student.name}`}
                />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );

  const exerciseItemsCount = exercises.filter(
    (e) => e.kind === "exercise"
  ).length;

  const quickCompleteModal = showQuickComplete ? (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => !finishing && setShowQuickComplete(false)}
      />
      <div className="relative max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-[28px] border border-[#050505]/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#10100e]">
        <div className="text-center mb-6">
          <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground">
            <CheckCircle2 className="size-7" />
          </div>
          <h2 className="mb-1 text-2xl font-black text-foreground">
            ¿Sesión completada?
          </h2>
          <p className="text-sm text-muted-foreground">
            Se marcará la sesión como completada
            {exerciseItemsCount > 0
              ? ` y los ${exerciseItemsCount} ejercicio${exerciseItemsCount !== 1 ? "s" : ""} como realizados`
              : ""}
            , sin ir uno por uno.
          </p>
          {finishError && (
            <p className="mt-3 text-sm font-semibold text-destructive">
              {finishError}
            </p>
          )}
        </div>
        {reviewFields}
        <div className="flex gap-3">
          <button
            onClick={() => setShowQuickComplete(false)}
            disabled={finishing}
            className="flex-1 rounded-full border border-[#050505]/10 px-4 py-2.5 text-sm font-black text-muted-foreground transition-colors hover:bg-muted dark:border-white/10"
          >
            Volver
          </button>
          <button
            onClick={() => handleFinish({ markAll: true })}
            disabled={finishing || sessionRating < 1}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-black text-brand-foreground transition-all hover:bg-brand/90 active:scale-95 disabled:opacity-60"
          >
            {finishing && <Loader2 className="size-4 animate-spin" />}
            Sí, completada
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (exercises.length === 0) {
    return (
      <div className="tp-page flex min-h-screen flex-col items-center justify-center p-6 text-center">
        <div className="mb-4 flex size-14 items-center justify-center rounded-full bg-brand/15">
          <Dumbbell className="size-7 text-foreground/45" />
        </div>
        <p className="mb-2 text-2xl font-black text-foreground/70">
          Esta sesión no tiene contenido.
        </p>
        <Link
          href={`/sessions/${session.id}`}
          className="mt-2 inline-flex h-10 items-center rounded-full border border-brand/30 px-4 text-sm font-black text-brand"
        >
          Volver a la sesión
        </Link>
      </div>
    );
  }

  // ── Pasar lista ─────────────────────────────────────────────────────
  if (!started && attendanceStage) {
    const presentCount = students.filter((s) => attendance[s.id]).length;
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#F4F4F1] text-[#050505] dark:bg-[#050505] dark:text-white">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#050505]/10 bg-white/86 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#10100e]/86">
          <button
            type="button"
            onClick={() => !savingAttendance && setAttendanceStage(false)}
            aria-label="Volver a la preparación"
            className="flex size-10 items-center justify-center rounded-full border border-[#050505]/10 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-white/10"
          >
            <ChevronLeft className="size-4" />
          </button>
          <p className="max-w-[200px] truncate text-xs font-semibold text-foreground">
            {session.title}
          </p>
          <div className="w-9" />
        </header>

        <main className="mx-auto w-full max-w-xl flex-1 space-y-5 px-4 py-8">
          <div className="space-y-2 text-center">
            <p className="tp-kicker">Pasar lista</p>
            <h1 className="text-3xl font-black leading-tight text-foreground">
              ¿Quién ha venido?
            </h1>
            <p className="text-sm text-muted-foreground">
              {presentCount} de {students.length} presente
              {presentCount !== 1 ? "s" : ""}. Toca a quien falte para
              marcarlo como ausente.
            </p>
          </div>

          <ul className="space-y-2">
            {students.map((student) => {
              const present = attendance[student.id] ?? true;
              return (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() =>
                      setAttendance((prev) => ({
                        ...prev,
                        [student.id]: !present,
                      }))
                    }
                    aria-pressed={present}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition-colors",
                      present
                        ? "border-brand/40 bg-brand/15"
                        : "border-[#050505]/10 bg-white opacity-70 dark:border-white/10 dark:bg-[#10100e]"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-full",
                        present
                          ? "bg-brand text-brand-foreground"
                          : "bg-muted text-muted-foreground"
                      )}
                    >
                      {present ? (
                        <Check className="size-4" />
                      ) : (
                        <X className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-base font-black text-foreground">
                      {student.name}
                    </span>
                    <span className="text-xs font-black text-muted-foreground">
                      {present ? "Presente" : "Ausente"}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </main>

        <footer className="border-t border-[#050505]/10 bg-white/86 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-white/10 dark:bg-[#10100e]/86">
          {attendanceError && (
            <p className="mb-3 text-center text-sm font-semibold text-destructive">
              {attendanceError}
            </p>
          )}
          <button
            onClick={confirmAttendance}
            disabled={savingAttendance}
            className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-brand text-base font-black text-brand-foreground shadow-sm transition-all hover:bg-brand/90 active:scale-[0.98] disabled:opacity-60"
          >
            {savingAttendance ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Play className="size-5 translate-x-0.5" />
            )}
            Empezar la clase
          </button>
        </footer>
      </div>
    );
  }

  // ── Preparation screen ──────────────────────────────────────────────
  if (!started) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#F4F4F1] text-[#050505] dark:bg-[#050505] dark:text-white">
        <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#050505]/10 bg-white/86 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#10100e]/86">
          <Link
            href={`/sessions/${session.id}`}
            className="flex size-10 items-center justify-center rounded-full border border-[#050505]/10 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-white/10"
          >
            <X className="size-4" />
          </Link>
          <p className="text-xs font-semibold text-foreground truncate max-w-[200px]">
            {session.title}
          </p>
          <div className="w-9" />
        </header>

        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-8 px-4 py-8">
          {/* Session overview */}
          <div className="text-center space-y-2">
            <p className="tp-kicker">Preparación</p>
            <h1 className="text-3xl font-black leading-tight text-foreground">
              {session.title}
            </h1>
            <p className="text-sm text-muted-foreground">
              {formatDate(session.scheduledAt)}
            </p>
            <div className="flex items-center justify-center gap-4 pt-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <Clock className="size-3.5 text-brand" />
                {session.durationMinutes} min
              </span>
              <span className="h-3 w-px bg-border" />
              <span className="flex items-center gap-1.5">
                <Dumbbell className="size-3.5 text-brand" />
                {totalExercises} elemento{totalExercises !== 1 ? "s" : ""}
              </span>
            </div>
          </div>

          {/* Materials checklist */}
          {allMaterials.length > 0 && (
            <div className="overflow-hidden rounded-[28px] border border-[#050505]/10 bg-white shadow-[0_24px_80px_-64px_rgba(5,5,5,0.7)] dark:border-white/10 dark:bg-[#10100e]">
              <div className="flex items-center gap-2 border-b border-[#050505]/10 px-5 py-4 dark:border-white/10">
                <Package className="size-4 text-brand" />
                <h2 className="text-sm font-black text-foreground">
                  Material necesario
                </h2>
                <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] font-black text-muted-foreground">
                  {allMaterials.length}
                </span>
              </div>
              <div className="px-5 py-4 flex flex-wrap gap-2">
                {allMaterials.map((m) => (
                  <span
                    key={m}
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand/20 bg-brand/15 px-3 py-1.5 text-xs font-black text-foreground"
                  >
                    <Package className="size-3 opacity-70" />
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Exercise list preview */}
          <div className="overflow-hidden rounded-[28px] border border-[#050505]/10 bg-white shadow-[0_24px_80px_-64px_rgba(5,5,5,0.7)] dark:border-white/10 dark:bg-[#10100e]">
            <div className="border-b border-[#050505]/10 px-5 py-3.5 dark:border-white/10">
              <h2 className="text-sm font-black text-foreground">
                Plan de la sesión
              </h2>
            </div>
            <div className="divide-y divide-[#050505]/10 dark:divide-white/10">
              {exercises.map((ex, idx) => (
                <div key={ex.key} className="flex items-center gap-3 px-5 py-3">
                  <span className="text-[10px] font-mono text-muted-foreground/50 w-4 shrink-0 text-right">
                    {idx + 1}
                  </span>
                  <div
                    className={cn(
                      "w-1 h-7 rounded-full shrink-0",
                      ex.category === "technique" && "bg-blue-400",
                      ex.category === "tactics" && "bg-purple-400",
                      ex.category === "fitness" && "bg-amber-400",
                      ex.category === "warm-up" && "bg-brand",
                      ex.category === "warmup" && "bg-sky-400",
                      ex.category === "stations" && "bg-emerald-400",
                      ![
                        "technique",
                        "tactics",
                        "fitness",
                        "warm-up",
                        "warmup",
                        "stations",
                      ].includes(ex.category) && "bg-muted"
                    )}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-black text-foreground",
                        ex.kind === "text"
                          ? "line-clamp-2 whitespace-pre-line font-semibold"
                          : "truncate"
                      )}
                    >
                      {ex.name}
                    </p>
                    <p
                      className={cn(
                        "text-[10px] font-semibold",
                        CATEGORY_ACCENT[ex.category] ?? "text-muted-foreground"
                      )}
                    >
                      {CATEGORY_LABELS[ex.category] ?? ex.category}
                    </p>
                  </div>
                  {ex.durationMinutes > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                      {ex.durationMinutes} min
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </main>

        <footer className="border-t border-[#050505]/10 bg-white/86 px-4 py-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-white/10 dark:bg-[#10100e]/86">
          <button
            onClick={handleStart}
            className="flex h-14 w-full items-center justify-center gap-2.5 rounded-full bg-brand text-base font-black text-brand-foreground shadow-sm transition-all hover:bg-brand/90 active:scale-[0.98]"
          >
            <Play className="size-5 translate-x-0.5" />
            Comenzar sesión
          </button>
          <button
            onClick={() => setShowQuickComplete(true)}
            className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-full border border-[#050505]/15 text-sm font-black text-foreground transition-colors hover:bg-muted dark:border-white/15"
          >
            <CheckCircle2 className="size-4" />
            Sesión completada
          </button>
        </footer>
        {quickCompleteModal}
      </div>
    );
  }

  // Hoja de ruta: qué se ha hecho, dónde estamos y qué queda
  const remainingMinutes = exercises
    .slice(currentIdx + 1)
    .reduce((sum, ex) => sum + (ex.durationMinutes || 0), 0);

  function renderRoadmap({ onPick }: { onPick?: () => void } = {}) {
    return (
      <div className="overflow-hidden rounded-[28px] border border-[#050505]/10 bg-white shadow-[0_24px_80px_-64px_rgba(5,5,5,0.7)] dark:border-white/10 dark:bg-[#10100e]">
        <div className="border-b border-[#050505]/10 px-5 py-3.5 dark:border-white/10">
          <h2 className="text-sm font-black text-foreground">Hoja de ruta</h2>
          <p className="text-[11px] text-muted-foreground">
            {done.size} de {totalExercises} hechos
            {remainingMinutes > 0 && ` · quedan ${remainingMinutes} min`}
          </p>
        </div>
        <ol className="divide-y divide-[#050505]/10 dark:divide-white/10">
          {exercises.map((ex, idx) => {
            const isCurrent = idx === currentIdx;
            const isSkipped = Boolean(executionById[ex.key]?.skipped);
            const isDone = done.has(ex.key) && !isCurrent;
            return (
              <li key={ex.key}>
                <button
                  type="button"
                  onClick={() => {
                    selectExercise(idx);
                    onPick?.();
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors",
                    isCurrent ? "bg-brand/15" : "hover:bg-muted/60",
                    isDone && "opacity-60"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-mono",
                      isCurrent
                        ? "bg-brand text-brand-foreground"
                        : isDone
                          ? "bg-brand/15 text-brand"
                          : "bg-muted text-muted-foreground"
                    )}
                  >
                    {isDone && !isSkipped ? (
                      <CheckCircle2 className="size-3.5" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "h-7 w-1 shrink-0 rounded-full",
                      CATEGORY_BAR[ex.category] ?? "bg-muted"
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-sm text-foreground",
                        isCurrent ? "font-black" : "font-semibold",
                        isDone && "line-through decoration-foreground/30"
                      )}
                    >
                      {ex.kind === "text" ? ex.name.split("\n")[0] : ex.name}
                    </span>
                    <span className="block text-[10px] font-semibold text-muted-foreground">
                      {isCurrent
                        ? "Ahora"
                        : isSkipped
                          ? "Saltado"
                          : isDone
                            ? "Hecho"
                            : "Pendiente"}
                      {ex.durationMinutes > 0 && ` · ${ex.durationMinutes} min`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    );
  }

  // ── Session in progress ─────────────────────────────────────────────
  const countdownPct =
    countdownMode && current
      ? Math.min(100, (timerSeconds / (current.durationMinutes * 60)) * 100)
      : 0;
  const currentExecution = executionById[current.key] ?? {
    actualDurationSeconds: 0,
    completed: false,
    skipped: false,
    rating: null,
    notes: "",
  };
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F4F4F1] text-[#050505] dark:bg-[#050505] dark:text-white">
      {/* Top bar */}
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#050505]/10 bg-white/86 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#10100e]/86">
        <Link
          href={`/sessions/${session.id}`}
          className="flex size-10 items-center justify-center rounded-full border border-[#050505]/10 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-white/10"
        >
          <X className="size-4" />
        </Link>

        <button
          type="button"
          onClick={() => setShowRoadmap(true)}
          aria-label="Ver hoja de ruta"
          className="ml-2 flex size-10 items-center justify-center rounded-full border border-[#050505]/10 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground lg:hidden dark:border-white/10"
        >
          <ListOrdered className="size-4" />
        </button>

        <div className="flex-1 text-center">
          <p className="text-xs font-semibold text-foreground truncate max-w-[160px]">
            {session.title}
          </p>
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {currentIdx + 1} / {totalExercises}
          </p>
        </div>

        <button
          onClick={() => setShowQuickComplete(true)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-brand border border-brand/30 bg-brand/5 px-3 py-1.5 rounded-full hover:bg-brand/15 transition-colors"
        >
          <Flag className="size-3" />
          Sesión completada
        </button>
      </header>

      {/* Progress bar */}
      <div className="h-1 bg-border">
        <div
          className="h-full bg-brand transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Exercise content */}
      <div className="mx-auto flex w-full max-w-6xl flex-1 gap-6 lg:px-4">
        {/* Hoja de ruta (escritorio/tablet horizontal): siempre visible al lado */}
        <aside className="hidden w-80 shrink-0 py-6 lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-8rem)] overflow-y-auto">
            {renderRoadmap()}
          </div>
        </aside>
        <main className="flex-1 flex flex-col px-4 py-6 max-w-2xl mx-auto w-full gap-5 lg:px-0">
          {/* Category + name */}
          <div
            ref={exerciseTopRef}
            className={cn(
              "scroll-mt-24 rounded-[28px] border p-6 shadow-[0_24px_80px_-64px_rgba(5,5,5,0.7)]",
              CATEGORY_COLORS[current.category] ??
                "border-[#050505]/10 bg-white dark:border-white/10 dark:bg-[#10100e]"
            )}
          >
            <p
              className={cn(
                "mb-2 text-[10px] font-black uppercase",
                CATEGORY_ACCENT[current.category] ?? "text-brand"
              )}
            >
              {CATEGORY_LABELS[current.category] ?? current.category}
            </p>
            {current.kind === "text" ? (
              <p className="mb-3 whitespace-pre-line text-xl font-bold leading-snug text-foreground">
                {current.name}
              </p>
            ) : (
              <h1 className="mb-3 text-3xl font-black leading-tight text-foreground">
                {current.name}
              </h1>
            )}
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              {current.durationMinutes > 0 && (
                <span className="flex items-center gap-1">
                  <Clock className="size-3" />
                  {current.durationMinutes} min sugeridos
                </span>
              )}
              {done.has(current.key) && (
                <span className="flex items-center gap-1 text-brand font-semibold">
                  <CheckCircle2 className="size-3" />
                  Completado
                </span>
              )}
            </div>
            {/* Atajo: botón Siguiente arriba, para no tener que bajar */}
            <button
              onClick={goNext}
              className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-full bg-foreground text-sm font-black text-background transition-all hover:bg-foreground/90 active:scale-[0.98]"
            >
              {currentIdx < totalExercises - 1 ? (
                <>
                  <SkipForward className="size-4" />
                  Siguiente
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Completar sesión
                </>
              )}
            </button>
          </div>

          {/* Timer */}
          <div className="overflow-hidden rounded-[28px] border border-[#050505]/10 bg-white shadow-[0_24px_80px_-64px_rgba(5,5,5,0.7)] dark:border-white/10 dark:bg-[#10100e]">
            {/* Countdown progress bar */}
            {countdownMode && (
              <div className="h-1 bg-border">
                <div
                  className={cn(
                    "h-full transition-all duration-1000",
                    countdownPct > 30
                      ? "bg-brand"
                      : countdownPct > 10
                        ? "bg-amber-400"
                        : "bg-red-400"
                  )}
                  style={{ width: `${countdownPct}%` }}
                />
              </div>
            )}
            <div className="flex items-center gap-4 p-5">
              <span
                className={cn(
                  "font-mono text-3xl tabular-nums flex-1",
                  countdownMode && timerSeconds === 0
                    ? "text-red-400"
                    : "text-foreground"
                )}
              >
                {formatTime(timerSeconds)}
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setTimerRunning((r) => !r)}
                  className="flex size-11 items-center justify-center rounded-full bg-brand text-brand-foreground transition-all hover:bg-brand/90 active:scale-95"
                  aria-label={timerRunning ? "Pausar" : "Iniciar"}
                >
                  {timerRunning ? (
                    <Pause className="size-5" />
                  ) : (
                    <Play className="size-5 translate-x-0.5" />
                  )}
                </button>
                <button
                  onClick={() => {
                    setTimerRunning(false);
                    setTimerSeconds(
                      countdownMode ? current.durationMinutes * 60 : 0
                    );
                  }}
                  className="flex size-11 items-center justify-center rounded-full border border-[#050505]/10 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-white/10"
                  aria-label="Reiniciar"
                >
                  <RotateCcw className="size-4" />
                </button>
                <button
                  onClick={toggleCountdown}
                  title={
                    countdownMode
                      ? "Cambiar a cronómetro"
                      : "Cambiar a cuenta atrás"
                  }
                  className={cn(
                    "flex size-11 items-center justify-center rounded-full border transition-colors",
                    countdownMode
                      ? "border-brand bg-brand/10 text-brand"
                      : "border-[#050505]/10 text-muted-foreground hover:bg-muted hover:text-foreground dark:border-white/10"
                  )}
                  aria-label={
                    countdownMode ? "Modo cronómetro" : "Modo cuenta atrás"
                  }
                >
                  <Timer className="size-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Live execution notes (solo ejercicios de la biblioteca) */}
          {current.kind === "exercise" && (
            <div className="space-y-4 rounded-[28px] border border-[#050505]/10 bg-white p-4 shadow-[0_24px_80px_-64px_rgba(5,5,5,0.7)] dark:border-white/10 dark:bg-[#10100e]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase text-muted-foreground">
                    Registro de pista
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Se guarda al completar la sesión.
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() =>
                        updateExecution(current.key, { rating: value })
                      }
                      className={cn(
                        "size-8 rounded-full border text-xs font-black transition-colors",
                        currentExecution.rating === value
                          ? "border-brand bg-brand text-brand-foreground"
                          : "border-[#050505]/10 text-muted-foreground hover:border-brand/40 hover:text-foreground dark:border-white/10"
                      )}
                      aria-label={`Valorar ejercicio con ${value}`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                value={currentExecution.notes}
                onChange={(event) =>
                  updateExecution(current.key, { notes: event.target.value })
                }
                rows={3}
                maxLength={1000}
                placeholder="Notas rápidas: ajuste aplicado, respuesta del alumno, variante usada..."
                className="tp-field w-full resize-none px-3 py-2 text-sm placeholder:text-muted-foreground"
              />
            </div>
          )}

          {/* Materials for this exercise */}
          {current.materials && current.materials.length > 0 && (
            <div className="flex items-start gap-3 rounded-[22px] border border-[#050505]/10 bg-white px-4 py-3 dark:border-white/10 dark:bg-[#10100e]">
              <Package className="size-4 text-brand mt-0.5 shrink-0" />
              <div className="flex flex-wrap gap-1.5">
                {current.materials.map((m) => (
                  <span
                    key={m}
                    className="rounded-full bg-brand/15 px-2 py-1 text-[11px] font-black text-foreground"
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          {current.description && (
            <div className="text-sm text-foreground/70 leading-relaxed">
              {current.description}
            </div>
          )}

          {current.exerciseId && diagrams?.[current.exerciseId] && (
            <ExerciseDiagramView
              diagram={diagrams[current.exerciseId]}
              maxWidth={280}
            />
          )}

          {/* Steps */}
          {current.steps.length > 0 && (
            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase text-muted-foreground">
                Pasos
              </p>
              <ol className="space-y-3">
                {current.steps.map((step, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-brand/20 bg-brand/15 text-[11px] font-black text-foreground">
                      {i + 1}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {step.title}
                      </p>
                      {step.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                          {step.description}
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Coach notes */}
          {current.notes && (
            <div className="rounded-[22px] border border-amber-500/20 bg-amber-500/10 p-4">
              <p className="mb-1.5 text-[10px] font-black uppercase text-amber-500/80">
                Notas del entrenador
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {current.notes}
              </p>
            </div>
          )}

          {/* Tips */}
          {current.tips && (
            <div className="rounded-[22px] border border-[#050505]/10 bg-white p-4 dark:border-white/10 dark:bg-[#10100e]">
              <p className="mb-1.5 text-[10px] font-black uppercase text-muted-foreground">
                Tips
              </p>
              <p className="text-sm text-foreground/70 leading-relaxed">
                {current.tips}
              </p>
            </div>
          )}
        </main>
      </div>

      {/* Hoja de ruta (móvil): panel lateral */}
      {showRoadmap && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="h-full w-[85%] max-w-sm overflow-y-auto bg-[#F4F4F1] p-4 pt-[calc(1rem+env(safe-area-inset-top))] shadow-2xl dark:bg-[#050505]">
            <div className="mb-3 flex justify-end">
              <button
                type="button"
                onClick={() => setShowRoadmap(false)}
                aria-label="Cerrar hoja de ruta"
                className="flex size-10 items-center justify-center rounded-full border border-[#050505]/10 text-muted-foreground dark:border-white/10"
              >
                <X className="size-4" />
              </button>
            </div>
            {renderRoadmap({ onPick: () => setShowRoadmap(false) })}
          </div>
          <button
            type="button"
            aria-label="Cerrar hoja de ruta"
            onClick={() => setShowRoadmap(false)}
            className="flex-1 bg-black/40"
          />
        </div>
      )}

      {/* Exercise index strip */}
      <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto border-t border-[#050505]/10 bg-white/86 px-4 py-3 backdrop-blur dark:border-white/10 dark:bg-[#10100e]/86">
        {exercises.map((ex, idx) => {
          const isDone = done.has(ex.key);
          const isCurrent = idx === currentIdx;
          return (
            <button
              key={ex.key}
              onClick={() => selectExercise(idx)}
              title={ex.name}
              className={cn(
                "shrink-0 size-8 rounded-full text-[10px] font-mono transition-all flex items-center justify-center",
                isCurrent
                  ? "bg-brand text-brand-foreground ring-2 ring-brand ring-offset-2 ring-offset-background"
                  : isDone
                    ? "bg-brand/15 text-brand border border-brand/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/60"
              )}
            >
              {isDone && !isCurrent ? (
                <CheckCircle2 className="size-3.5" />
              ) : (
                idx + 1
              )}
            </button>
          );
        })}
      </div>

      {/* Bottom nav */}
      <footer className="flex items-center gap-3 border-t border-[#050505]/10 bg-white/86 px-4 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur dark:border-white/10 dark:bg-[#10100e]/86">
        <button
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="flex size-12 items-center justify-center rounded-full border border-[#050505]/10 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-30 dark:border-white/10"
        >
          <ChevronLeft className="size-5" />
        </button>

        <button
          onClick={skipCurrent}
          className="h-12 shrink-0 rounded-full border border-[#050505]/10 px-4 text-xs font-black text-muted-foreground transition-colors hover:bg-muted hover:text-foreground dark:border-white/10"
        >
          Saltar
        </button>

        <button
          onClick={goNext}
          className="flex h-12 flex-1 items-center justify-center gap-2 rounded-full bg-foreground text-sm font-black text-background transition-all hover:bg-foreground/90 active:scale-[0.98]"
        >
          {currentIdx < totalExercises - 1 ? (
            <>
              <SkipForward className="size-4" />
              Siguiente
            </>
          ) : (
            <>
              <CheckCircle2 className="size-4" />
              Completar sesión
            </>
          )}
        </button>
      </footer>

      {/* Finish modal */}
      {showFinish && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => !finishing && setShowFinish(false)}
          />
          <div className="relative max-h-[92dvh] w-full max-w-sm overflow-y-auto rounded-[28px] border border-[#050505]/10 bg-white p-6 shadow-2xl dark:border-white/10 dark:bg-[#10100e]">
            <div className="text-center mb-6">
              <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-brand text-brand-foreground">
                <CheckCircle2 className="size-7" />
              </div>
              <h2 className="mb-1 text-2xl font-black text-foreground">
                ¡Sesión completada!
              </h2>
              <p className="text-sm text-muted-foreground">
                {done.size} de {totalExercises} elementos realizados
              </p>
              {finishError && (
                <p className="mt-3 text-sm font-semibold text-destructive">
                  {finishError}
                </p>
              )}
            </div>
            {reviewFields}
            <div className="flex gap-3">
              <button
                onClick={() => setShowFinish(false)}
                disabled={finishing}
                className="flex-1 rounded-full border border-[#050505]/10 px-4 py-2.5 text-sm font-black text-muted-foreground transition-colors hover:bg-muted dark:border-white/10"
              >
                Seguir
              </button>
              <button
                onClick={() => handleFinish()}
                disabled={finishing || sessionRating < 1}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-brand px-4 py-2.5 text-sm font-black text-brand-foreground transition-all hover:bg-brand/90 active:scale-95 disabled:opacity-60"
              >
                {finishing && <Loader2 className="size-4 animate-spin" />}
                Guardar y salir
              </button>
            </div>
          </div>
        </div>
      )}
      {quickCompleteModal}
    </div>
  );
}
