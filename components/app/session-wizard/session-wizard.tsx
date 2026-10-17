"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { DraftStatusPill } from "@/components/app/draft-status-pill";
import {
  generateDraftId,
  getSessionDraft,
  hasMeaningfulSessionDraft,
  migrateLocalStorageDrafts,
  removeSessionDraft,
  upsertSessionDraft,
  type SessionDraftPayload,
} from "@/lib/drafts";
import { defaultScheduledAt } from "./defaults";
import { ProgressIndicator } from "./progress-indicator";
import { StepConfiguration } from "./step-configuration";
import { StepExercises } from "./step-exercises";
import { computeSessionDates, sessionCode } from "./recurrence";
import {
  buildBlocksPayload,
  buildExercisesPayload,
  computeTimelineDuration,
  hasPlanContent,
  isTextItem,
  normalizeBlocks,
  textItemsFromBlocks,
} from "./timeline";
import type {
  AvailableExercise,
  WizardExercise,
  WizardSessionBlock,
  WizardState,
} from "./types";

const STEP_LABELS = ["Configuración", "Ejercicios"];
const TOTAL_STEPS = STEP_LABELS.length;
interface SessionWizardProps {
  availableExercises: AvailableExercise[];
  initialExercises?: WizardExercise[];
  initialTitle?: string;
  initialObjective?: string;
  initialMaterial?: string;
  initialObservations?: string;
  initialTags?: string[];
  initialSourceClassId?: string | null;
  initialBlocks?: WizardSessionBlock[];
  initialLocation?: string;
  initialPlaceId?: string | null;
  /** Grupo al que se preasigna la sesión (p. ej. desde "Asignar clase" en la ficha de grupo). */
  initialGroupId?: string | null;
  initialGroupName?: string;
  initialStudentIds?: string[];
  /** "YYYY-MM-DDTHH:mm" ya calculado (p. ej. próximo día habitual del grupo). */
  initialScheduledAt?: string;
  places?: { id: string; name: string }[];
  monitorName?: string;
  allowDraftRestore?: boolean;
  /** Editar una sesión existente (también las pasadas). */
  edit?: {
    sessionId: string;
    initialState: Partial<WizardState>;
  };
}

function validateStep(
  step: number,
  state: WizardState
): Partial<Record<keyof WizardState, string>> {
  const errors: Partial<Record<keyof WizardState, string>> = {};

  if (step === 1) {
    if (!state.title.trim()) errors.title = "El título es obligatorio";
    else if (state.title.trim().length > 255) {
      errors.title = "Máximo 255 caracteres";
    }

    if (!state.scheduledAt) {
      errors.scheduledAt = "La fecha y hora son obligatorias";
    } else {
      const parsed = new Date(state.scheduledAt);
      if (isNaN(parsed.getTime())) errors.scheduledAt = "Fecha inválida";
    }

    if (
      !state.durationMinutes ||
      state.durationMinutes < 5 ||
      state.durationMinutes > 600
    ) {
      errors.durationMinutes = "Duración entre 5 y 600 minutos";
    }

    if (
      state.intensity !== null &&
      (state.intensity < 1 || state.intensity > 5)
    ) {
      errors.intensity = "Intensidad debe ser 1-5";
    }

    if (state.tags.length > 10) errors.tags = "Máximo 10 etiquetas";
  }

  if (step === 2) {
    if (!hasPlanContent(state) && !state.recurrence.enabled) {
      errors.exercises =
        "Añade al menos un ejercicio o un texto libre antes de guardar la sesión";
    }
  }

  return errors;
}

function isWizardExercise(value: unknown): value is WizardExercise {
  if (!value || typeof value !== "object") return false;

  const exercise = value as Partial<WizardExercise>;
  return (
    typeof exercise.exerciseId === "string" &&
    typeof exercise.name === "string" &&
    typeof exercise.category === "string" &&
    typeof exercise.durationMinutes === "number" &&
    (typeof exercise.overrideDuration === "number" ||
      exercise.overrideDuration === null) &&
    typeof exercise.notes === "string" &&
    (exercise.phase === "activation" ||
      exercise.phase === "main" ||
      exercise.phase === "cooldown" ||
      exercise.phase === null) &&
    (typeof exercise.intensity === "number" || exercise.intensity === null)
  );
}

function isWizardSessionBlock(value: unknown): value is WizardSessionBlock {
  if (!value || typeof value !== "object") return false;
  const block = value as Partial<WizardSessionBlock>;
  return (
    (block.orderIndex === 1 ||
      block.orderIndex === 2 ||
      block.orderIndex === 3) &&
    typeof block.title === "string" &&
    typeof block.notes === "string" &&
    Array.isArray(block.items)
  );
}

function createInitialState({
  initialExercises,
  initialTitle,
  initialObjective,
  initialMaterial,
  initialObservations,
  initialTags,
  initialSourceClassId,
  initialBlocks,
  initialLocation,
  initialPlaceId,
  initialGroupId,
  initialGroupName,
  initialStudentIds,
  initialScheduledAt,
}: Pick<
  SessionWizardProps,
  | "initialExercises"
  | "initialTitle"
  | "initialObjective"
  | "initialMaterial"
  | "initialObservations"
  | "initialTags"
  | "initialSourceClassId"
  | "initialBlocks"
  | "initialLocation"
  | "initialPlaceId"
  | "initialGroupId"
  | "initialGroupName"
  | "initialStudentIds"
  | "initialScheduledAt"
>): WizardState {
  const scheduledAt = initialScheduledAt ?? defaultScheduledAt();
  // Si la sesión viene preasignada a un grupo (p. ej. "Asignar clase" desde
  // la ficha de grupo), se activa el mismo nombre automático AAMMDD_Grupo
  // que usa el paso de alumnos al elegir un grupo manualmente.
  const useCodeTitle = !!initialGroupId && !initialTitle;
  return {
    title: useCodeTitle
      ? sessionCode(new Date(scheduledAt), initialGroupName ?? "")
      : (initialTitle ?? ""),
    scheduledAt,
    durationMinutes: 60,
    location: initialLocation ?? "",
    placeId: initialPlaceId ?? null,
    objective: initialObjective ?? "",
    material: initialMaterial ?? "",
    observations: initialObservations ?? "",
    sourceClassId: initialSourceClassId ?? null,
    intensity: null,
    tags: initialTags ?? [],
    studentIds: initialStudentIds ?? [],
    exercises: [
      ...(initialExercises ?? []),
      ...textItemsFromBlocks(initialBlocks),
    ],
    blocks: normalizeBlocks(initialBlocks),
    recurrence: {
      enabled: false,
      frequency: "weekly",
      weeks: 4,
      weekdays: [],
      mode: "until",
    },
    groupId: initialGroupId ?? null,
    selectedGroupIds: initialGroupId ? [initialGroupId] : [],
    groupName: initialGroupName,
    useCodeTitle,
  };
}

function toDraftPayload(state: WizardState): SessionDraftPayload {
  return {
    title: state.title,
    scheduledAt: state.scheduledAt,
    durationMinutes: state.durationMinutes,
    location: state.location,
    placeId: state.placeId,
    objective: state.objective,
    material: state.material,
    observations: state.observations,
    sourceClassId: state.sourceClassId,
    intensity: state.intensity,
    tags: state.tags,
    studentIds: state.studentIds,
    exercises: state.exercises,
    blocks: state.blocks,
  };
}

function sanitizeDraftPayload(
  payload: Partial<SessionDraftPayload> | null | undefined,
  fallback: WizardState
): WizardState {
  if (!payload || typeof payload !== "object") {
    return fallback;
  }

  return {
    title: typeof payload.title === "string" ? payload.title : fallback.title,
    scheduledAt:
      typeof payload.scheduledAt === "string" && payload.scheduledAt
        ? payload.scheduledAt
        : fallback.scheduledAt,
    durationMinutes:
      typeof payload.durationMinutes === "number"
        ? payload.durationMinutes
        : fallback.durationMinutes,
    location:
      typeof payload.location === "string"
        ? payload.location
        : fallback.location,
    placeId:
      typeof payload.placeId === "string" || payload.placeId === null
        ? payload.placeId
        : fallback.placeId,
    objective:
      typeof payload.objective === "string"
        ? payload.objective
        : fallback.objective,
    material:
      typeof payload.material === "string"
        ? payload.material
        : fallback.material,
    observations:
      typeof payload.observations === "string"
        ? payload.observations
        : fallback.observations,
    sourceClassId:
      typeof payload.sourceClassId === "string" ||
      payload.sourceClassId === null
        ? payload.sourceClassId
        : fallback.sourceClassId,
    intensity:
      typeof payload.intensity === "number" || payload.intensity === null
        ? payload.intensity
        : fallback.intensity,
    tags: Array.isArray(payload.tags)
      ? payload.tags.filter((tag): tag is string => typeof tag === "string")
      : fallback.tags,
    studentIds: Array.isArray(payload.studentIds)
      ? payload.studentIds.filter(
          (studentId): studentId is string => typeof studentId === "string"
        )
      : fallback.studentIds,
    exercises: Array.isArray(payload.exercises)
      ? [
          ...payload.exercises.filter(isWizardExercise),
          // Borradores antiguos guardaban los textos libres dentro de bloques.
          ...(payload.exercises.some(
            (item) => isWizardExercise(item) && isTextItem(item)
          )
            ? []
            : textItemsFromBlocks(
                Array.isArray(payload.blocks)
                  ? payload.blocks.filter(isWizardSessionBlock)
                  : undefined
              )),
        ]
      : fallback.exercises,
    blocks: Array.isArray(payload.blocks)
      ? normalizeBlocks(payload.blocks.filter(isWizardSessionBlock))
      : fallback.blocks,
    recurrence: fallback.recurrence,
  };
}

export function SessionWizard({
  availableExercises,
  initialExercises,
  initialTitle,
  initialObjective,
  initialMaterial,
  initialObservations,
  initialTags,
  initialSourceClassId,
  initialBlocks,
  initialLocation,
  initialPlaceId,
  initialGroupId,
  initialGroupName,
  initialStudentIds,
  initialScheduledAt,
  places = [],
  monitorName,
  allowDraftRestore = true,
  edit,
}: SessionWizardProps) {
  const isEdit = !!edit;
  const router = useRouter();
  const searchParams = useSearchParams();
  // El paso vive en el estado del asistente (y se refleja en la URL sin
  // navegar): cambiar de paso con el router podía volver a montar el
  // asistente y perder lo escrito en el paso 1 (objetivo, lugar, duración…).
  const [step, setStep] = useState(() => {
    const raw = parseInt(searchParams.get("step") ?? "1", 10);
    return Number.isFinite(raw) && raw >= 1 && raw <= TOTAL_STEPS ? raw : 1;
  });
  const [baselineState] = useState<WizardState>(() => {
    const base = createInitialState({
      initialExercises,
      initialTitle,
      initialObjective,
      initialMaterial,
      initialObservations,
      initialTags,
      initialSourceClassId,
      initialBlocks,
      initialLocation,
      initialPlaceId,
      initialGroupId,
      initialGroupName,
      initialStudentIds,
      initialScheduledAt,
    });
    if (!edit) return base;
    const merged = { ...base, ...edit.initialState };
    // Una duración guardada distinta de la del plan se fijó a mano.
    const planMinutes = hasPlanContent(merged)
      ? computeTimelineDuration(merged)
      : 0;
    return {
      ...merged,
      durationManual: planMinutes > 0 && planMinutes !== merged.durationMinutes,
    };
  });

  const [state, setState] = useState<WizardState>(baselineState);

  // La "Duración" del paso 1 refleja el contenido real del plan: en cuanto
  // hay ejercicios/textos en la línea de tiempo, se recalcula a partir de
  // ellos (igual que hace el servidor al guardar), para que el resumen de
  // la sesión nunca muestre un número desactualizado. Sin contenido (p.
  // ej. antes de llegar al paso 2, o una sesión por recurrencia sin plan
  // propio) se deja el valor manual tal cual.
  useEffect(() => {
    if (state.durationManual || !hasPlanContent(state)) return;
    const computed = computeTimelineDuration(state);
    if (computed > 0 && computed !== state.durationMinutes) {
      setState((prev) => ({ ...prev, durationMinutes: computed }));
    }
    // Solo debe reaccionar a cambios en el contenido del plan, no a cada
    // cambio de estado (evita un bucle con la propia escritura de arriba).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.exercises]);

  // En edición la fecha llega en ISO (UTC); se pasa a la hora local del
  // navegador para el campo fecha/hora.
  useEffect(() => {
    if (!edit?.initialState.scheduledAt) return;
    const d = new Date(edit.initialState.scheduledAt);
    if (isNaN(d.getTime())) return;
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    setState((prev) => ({ ...prev, scheduledAt: local }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [, setHasDraft] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const draftReadyRef = useRef(false);
  const draftIdRef = useRef<string | null>(null);
  const baselinePayloadRef = useRef<SessionDraftPayload>(
    toDraftPayload(baselineState)
  );

  // One-time mount hydration — intentionally empty deps to avoid re-running
  // when the URL is updated by manual draft save.
  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (isEdit) {
        // En edición no se usan borradores.
        draftReadyRef.current = false;
        return;
      }
      const params = new URLSearchParams(window.location.search);
      const restoredDraftId = params.get("draft");

      if (!restoredDraftId && allowDraftRestore) {
        await migrateLocalStorageDrafts();
      }

      if (restoredDraftId) {
        const draft = await getSessionDraft(restoredDraftId);
        if (cancelled) return;

        if (draft) {
          draftReadyRef.current = false;
          draftIdRef.current = restoredDraftId;
          setHasDraft(true);
          setState(sanitizeDraftPayload(draft.payload, baselineState));
          window.setTimeout(() => {
            if (!cancelled) draftReadyRef.current = true;
          }, 0);
        } else {
          // Draft param in URL but no matching draft — clean up
          draftIdRef.current = null;
          const cleanParams = new URLSearchParams(window.location.search);
          cleanParams.delete("draft");
          const next = cleanParams.toString();
          window.history.replaceState(
            null,
            "",
            next
              ? `${window.location.pathname}?${next}`
              : window.location.pathname
          );
          draftReadyRef.current = true;
        }
      } else {
        draftReadyRef.current = true;
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const draftPayload = useMemo(() => toDraftPayload(state), [state]);

  const errors = useMemo(() => validateStep(step, state), [step, state]);
  const canProceed = Object.keys(errors).length === 0;

  function update(patch: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  async function handleSaveDraft() {
    if (!draftReadyRef.current) return;

    if (!hasMeaningfulSessionDraft(draftPayload, baselinePayloadRef.current)) {
      if (draftIdRef.current) {
        await removeSessionDraft(draftIdRef.current);
        draftIdRef.current = null;
        setHasDraft(false);
        const params = new URLSearchParams(window.location.search);
        if (params.has("draft")) {
          params.delete("draft");
          const next = params.toString();
          window.history.replaceState(
            null,
            "",
            next
              ? `${window.location.pathname}?${next}`
              : window.location.pathname
          );
        }
      }
      setSaveStatus("idle");
      setSavedAt(null);
      return;
    }

    let nextDraftId = draftIdRef.current;
    if (!nextDraftId) {
      nextDraftId = generateDraftId();
      draftIdRef.current = nextDraftId;
      setHasDraft(true);
      const params = new URLSearchParams(window.location.search);
      params.set("draft", nextDraftId);
      window.history.replaceState(
        null,
        "",
        `${window.location.pathname}?${params.toString()}`
      );
    }

    setSaveStatus("saving");
    try {
      await upsertSessionDraft({
        id: nextDraftId,
        title: draftPayload.title.trim() || "Sesión sin título",
        updatedAt: new Date().toISOString(),
        payload: draftPayload,
      });
      setSaveStatus("saved");
      setSavedAt(new Date());
    } catch {
      setSaveStatus("idle");
    }
  }

  function goToStep(next: number) {
    const clamped = Math.max(1, Math.min(TOTAL_STEPS, next));
    // Read from window.location.search so the draft param set via history.replaceState is preserved
    const params = new URLSearchParams(window.location.search);
    params.set("step", String(clamped));
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${params.toString()}`
    );
    setStep(clamped);
    setShowErrors(false);
  }

  function onNext() {
    if (!canProceed) {
      setShowErrors(true);
      return;
    }

    goToStep(step + 1);
  }

  function onPrev() {
    goToStep(step - 1);
  }

  async function onSubmit() {
    const allErrors = validateStep(1, state);
    if (Object.keys(allErrors).length > 0) {
      setShowErrors(true);
      goToStep(1);
      return;
    }

    setSubmitting(true);
    setServerError(null);

    try {
      const scheduledDate = new Date(state.scheduledAt);
      const scheduledIso = scheduledDate.toISOString();

      // Fechas: la primera + las repeticiones (semanas o hasta fin de curso).
      const sessionDates = edit
        ? [scheduledDate]
        : computeSessionDates(scheduledDate, state.recurrence).dates;
      const titleFor = (date: Date) =>
        !edit && state.useCodeTitle
          ? sessionCode(date, state.groupName ?? "")
          : state.title.trim();

      const exercisesPayload = buildExercisesPayload(state);
      const blocksPayload = buildBlocksPayload(state);
      // Por si el efecto de sincronización aún no ha corrido (p. ej. se
      // envía justo tras el último cambio): recalcula aquí también, para
      // que lo guardado siempre sea el contenido real del plan.
      // La duración marcada a mano se respeta; si no, la del plan.
      const durationMinutes =
        !state.durationManual && hasPlanContent(state)
          ? computeTimelineDuration(state)
          : state.durationMinutes;

      if (edit) {
        const res = await fetch(`/api/sessions/${edit.sessionId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: state.title.trim(),
            scheduledAt: scheduledIso,
            durationMinutes,
            durationManual: !!state.durationManual,
            objective: state.objective.trim() || null,
            material: state.material.trim() || null,
            observations: state.observations.trim() || null,
            intensity: state.intensity,
            tags: state.tags.length > 0 ? state.tags : null,
            location: state.location.trim() || null,
            placeId: state.placeId,
            groupId: state.groupId ?? null,
            studentIds: state.studentIds,
            exercises: exercisesPayload,
            blocks: blocksPayload,
          }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => ({}))) as {
            details?: Array<{ message: string }>;
            error?: string;
          };
          setServerError(
            data.details?.map((d) => d.message).join(". ") ??
              data.error ??
              "No se pudieron guardar los cambios."
          );
          return;
        }
        router.push(`/sessions/${edit.sessionId}`);
        router.refresh();
        return;
      }

      // Submit all sessions sequentially. If any fails we stop and report.
      let res: Response | null = null;
      let createdCount = 0;
      for (const date of sessionDates) {
        if (sessionDates.length > 1) {
          setProgress({ done: createdCount, total: sessionDates.length });
        }
        res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: titleFor(date),
            description: null,
            scheduledAt: date.toISOString(),
            durationMinutes,
            durationManual: !!state.durationManual,
            objective: state.objective.trim() || null,
            material: state.material.trim() || null,
            observations: state.observations.trim() || null,
            sourceClassId: state.sourceClassId,
            intensity: state.intensity,
            tags: state.tags.length > 0 ? state.tags : null,
            location: state.location.trim() || null,
            placeId: state.placeId,
            groupId: state.groupId ?? null,
            studentIds: state.studentIds,
            exercises: exercisesPayload,
            blocks: blocksPayload,
          }),
        });
        if (!res.ok) break;
        createdCount++;
      }
      setProgress(null);

      // Use the last response for downstream handling so failures bubble up.
      if (!res) {
        setServerError("No se pudo crear la sesión.");
        return;
      }

      const data = (await res.json().catch(() => ({}))) as {
        details?: Array<{ message: string }>;
        error?: string;
        inaccessibleExerciseIds?: string[];
      };

      if (!res.ok) {
        if (
          Array.isArray(data.inaccessibleExerciseIds) &&
          data.inaccessibleExerciseIds.length > 0
        ) {
          const blockedIds = new Set(data.inaccessibleExerciseIds);
          setState((prev) => ({
            ...prev,
            exercises: prev.exercises.filter(
              (exercise) => !blockedIds.has(exercise.exerciseId)
            ),
          }));
          setShowErrors(true);
          setServerError(
            "Se quitaron ejercicios que ya no existen o a los que no tienes acceso. Revisa el plan y vuelve a intentarlo."
          );
          return;
        }

        const msg =
          data.details
            ?.map((detail: { message: string }) => detail.message)
            .join(". ") ??
          data.error ??
          "Ha ocurrido un error.";
        setServerError(
          createdCount > 0
            ? `Se crearon ${createdCount} de ${sessionDates.length} sesiones; el resto falló: ${msg}`
            : msg
        );
        return;
      }

      if (draftIdRef.current) {
        void removeSessionDraft(draftIdRef.current);
        draftIdRef.current = null;
        setHasDraft(false);
      }

      // Si la sesión queda vinculada a un grupo, volvemos a su
      // planificación (y no a /sessions) para que se vea de inmediato: de
      // paso evita que la ficha de grupo se quede con el listado de
      // sesiones cacheado por el router de Next de antes de crearla.
      router.push(state.groupId ? `/groups/${state.groupId}` : "/sessions");
      router.refresh();
    } catch {
      setServerError("Error de red. Inténtalo de nuevo.");
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  const visibleErrors = showErrors ? errors : {};

  return (
    <div className="flex w-full flex-col gap-8 rounded-lg border border-[#050505]/10 bg-white p-4 pb-28 shadow-[0_18px_60px_rgba(5,5,5,0.05)] dark:border-white/10 dark:bg-white/[0.045] sm:p-5 md:pb-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <ProgressIndicator
          step={step}
          total={TOTAL_STEPS}
          labels={STEP_LABELS}
        />
        <div
          className={cn(
            "mt-1 flex items-center gap-2 sm:shrink-0",
            isEdit && "hidden"
          )}
        >
          <button
            type="button"
            onClick={() => void handleSaveDraft()}
            disabled={saveStatus === "saving" || submitting}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-[#F4F4F1] px-3 py-1.5 text-[11px] font-bold text-foreground transition-colors hover:border-[#D6FF38]/70 disabled:opacity-55 dark:bg-[#050505]/70"
          >
            {saveStatus === "saving" ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : null}
            Borrador
          </button>
          <DraftStatusPill
            status={saveStatus}
            savedAt={savedAt}
            className="sm:shrink-0"
          />
        </div>
      </div>

      <div className="rounded-lg border border-foreground/10 bg-[#F4F4F1] px-4 py-3 dark:bg-[#050505]/70">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground/45">
          Paso {step} de {TOTAL_STEPS}
        </p>
        <h2 className="font-heading text-2xl font-semibold text-foreground">
          {step === 1 ? "Configuración" : "Ejercicios"}
        </h2>
      </div>

      <div className="min-h-[320px]">
        {step === 1 ? (
          <StepConfiguration
            state={state}
            update={update}
            errors={visibleErrors}
            places={places}
            monitorName={monitorName}
            hideRecurrence={isEdit}
          />
        ) : (
          <StepExercises
            state={state}
            update={update}
            availableExercises={availableExercises}
          />
        )}
      </div>

      {showErrors && visibleErrors.exercises ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3">
          <p className="text-sm font-medium text-destructive">
            {visibleErrors.exercises}
          </p>
        </div>
      ) : null}

      {serverError ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-4 py-3">
          <p className="text-sm font-medium text-destructive">{serverError}</p>
        </div>
      ) : null}

      {/* Navigation bar */}
      <div
        className={cn(
          "flex items-center justify-between gap-3",
          "max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:z-40 max-md:border-t max-md:border-border max-md:bg-background/95 max-md:px-4 max-md:py-3 max-md:backdrop-blur",
          "md:border-t md:border-border/50 md:pt-5"
        )}
      >
        {step === 1 ? (
          <Link
            href={edit ? `/sessions/${edit.sessionId}` : "/sessions"}
            className="px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancelar
          </Link>
        ) : (
          <button
            type="button"
            onClick={onPrev}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            <ChevronLeft className="size-4" />
            Atrás
          </button>
        )}

        {step < TOTAL_STEPS ? (
          <div className="flex items-center gap-2">
            {isEdit && (
              <button
                type="button"
                onClick={onSubmit}
                disabled={
                  submitting ||
                  (!hasPlanContent(state) && !state.recurrence.enabled)
                }
                className="inline-flex items-center gap-2 rounded-full border border-foreground/15 px-4 py-2.5 text-sm font-bold text-foreground transition-colors hover:border-foreground/30 disabled:opacity-55"
              >
                {submitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : null}
                <span className="sm:hidden">Guardar</span>
                <span className="hidden sm:inline">Guardar cambios</span>
              </button>
            )}
            <button
              type="button"
              onClick={onNext}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg bg-brand px-6 py-2.5 text-sm font-bold text-brand-foreground transition-colors",
                "rounded-full bg-[#D6FF38] text-[#050505]",
                canProceed
                  ? "hover:bg-[#c8ef2f]"
                  : "opacity-55 cursor-not-allowed"
              )}
            >
              Siguiente
              <ChevronRight className="size-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            {state.exercises.length > 0 && (
              <span className="text-xs text-muted-foreground tabular-nums hidden sm:block">
                {state.exercises.length} elemento
                {state.exercises.length !== 1 ? "s" : ""}
                {" · "}
                {state.exercises.reduce(
                  (sum, e) => sum + (e.overrideDuration ?? e.durationMinutes),
                  0
                )}{" "}
                min
              </span>
            )}
            <button
              type="button"
              onClick={onSubmit}
              disabled={
                submitting ||
                (!hasPlanContent(state) && !state.recurrence.enabled)
              }
              className="inline-flex items-center gap-2 rounded-full bg-[#D6FF38] px-6 py-2.5 text-sm font-bold text-[#050505] transition-colors hover:bg-[#c8ef2f] disabled:opacity-55"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
              {isEdit
                ? "Guardar cambios"
                : progress
                  ? `Creando ${progress.done + 1} de ${progress.total}…`
                  : state.recurrence.enabled
                    ? "Crear sesiones"
                    : "Crear sesión"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
