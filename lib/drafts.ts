// Storage keys kept only for the one-time migration from localStorage → DB
export const EXERCISE_DRAFTS_STORAGE_KEY = "exercise-drafts-v1";
export const SESSION_DRAFTS_STORAGE_KEY = "session-drafts-v1";
export const LEGACY_SESSION_DRAFT_STORAGE_KEY = "session-wizard-draft-v1";

export interface ExerciseDraftPayload {
  name: string;
  description: string;
  objectives: string;
  tips: string;
  variantes: string;
  observaciones: string;
  category?: string;
  difficulty?: string;
  durationMinutes?: number;
  location?: string | null;
  videoUrl?: string;
  phase?: string | null;
  intensity?: number | null;
  formato?: string | null;
  numJugadores?: number | null;
  tipoPelota?: string | null;
  tipoActividad?: string | null;
  nivel?: string | null;
  niveles?: string[];
  aspectoJuego?: string | null;
  aspectosJuego?: string[];
  parametro?: string | null;
  parametros?: string[];
  tiposActividad?: string[];
  caracter?: string[];
  situacionJuego?: string[];
  duracionRango?: string | null;
  isGlobal?: boolean;
  autoria?: string | null;
  steps: Array<{ id: string; title: string; description: string }>;
  materials: string[];
  images: Array<string | null>;
  golpes: string[];
  efecto: string[];
  formMode: "quick" | "full";
}

export interface ExerciseDraft {
  id: string;
  name: string;
  updatedAt: string;
  payload: ExerciseDraftPayload;
}

export interface SessionDraftPayload {
  title: string;
  scheduledAt: string;
  durationMinutes: number;
  location: string;
  placeId: string | null;
  objective: string;
  material: string;
  observations: string;
  sourceClassId: string | null;
  intensity: number | null;
  tags: string[];
  studentIds: string[];
  exercises: Array<{
    exerciseId: string;
    name: string;
    category: string;
    durationMinutes: number;
    overrideDuration: number | null;
    notes: string;
    phase: "activation" | "main" | "cooldown" | null;
    intensity: number | null;
  }>;
  blocks: Array<{
    orderIndex: 1 | 2 | 3;
    title: string;
    notes: string;
    items: Array<{
      exerciseId?: string | null;
      freeText?: string | null;
      durationMinutes?: number | null;
      notes?: string | null;
    }>;
  }>;
}

export interface SessionDraft {
  id: string;
  title: string;
  updatedAt: string;
  payload: SessionDraftPayload;
}

// ── Exercise drafts ──────────────────────────────────────────────────────────

export async function listExerciseDrafts(): Promise<ExerciseDraft[]> {
  const res = await fetch("/api/exercise-drafts");
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data: Array<{
      id: string;
      payload: ExerciseDraftPayload;
      updatedAt: string;
    }>;
  };
  return json.data.map((d) => ({
    id: d.id,
    name: d.payload.name ?? "",
    updatedAt: d.updatedAt,
    payload: d.payload,
  }));
}

export async function getExerciseDraft(
  id: string
): Promise<ExerciseDraft | null> {
  const drafts = await listExerciseDrafts();
  return drafts.find((d) => d.id === id) ?? null;
}

export async function upsertExerciseDraft(draft: ExerciseDraft): Promise<void> {
  await fetch("/api/exercise-drafts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: draft.id, payload: draft.payload }),
  });
  window.dispatchEvent(
    new CustomEvent("tenplanner:drafts-updated", {
      detail: { key: EXERCISE_DRAFTS_STORAGE_KEY },
    })
  );
}

export async function removeExerciseDraft(id: string): Promise<void> {
  await fetch(`/api/exercise-drafts/${id}`, { method: "DELETE" });
  window.dispatchEvent(
    new CustomEvent("tenplanner:drafts-updated", {
      detail: { key: EXERCISE_DRAFTS_STORAGE_KEY },
    })
  );
}

// ── Session drafts ───────────────────────────────────────────────────────────

export async function listSessionDrafts(): Promise<SessionDraft[]> {
  const res = await fetch("/api/session-drafts");
  if (!res.ok) return [];
  const json = (await res.json()) as {
    data: Array<{
      id: string;
      payload: SessionDraftPayload;
      updatedAt: string;
    }>;
  };
  return json.data.map((d) => ({
    id: d.id,
    title: d.payload.title ?? "",
    updatedAt: d.updatedAt,
    payload: d.payload,
  }));
}

export async function getSessionDraft(
  id: string
): Promise<SessionDraft | null> {
  const drafts = await listSessionDrafts();
  return drafts.find((d) => d.id === id) ?? null;
}

export async function upsertSessionDraft(draft: SessionDraft): Promise<void> {
  await fetch("/api/session-drafts", {
    method: "POST",
    // keepalive: que el guardado termine aunque la página se cierre o navegue.
    keepalive: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id: draft.id, payload: draft.payload }),
  });
  window.dispatchEvent(
    new CustomEvent("tenplanner:drafts-updated", {
      detail: { key: SESSION_DRAFTS_STORAGE_KEY },
    })
  );
}

export async function removeSessionDraft(id: string): Promise<void> {
  await fetch(`/api/session-drafts/${id}`, { method: "DELETE" });
  window.dispatchEvent(
    new CustomEvent("tenplanner:drafts-updated", {
      detail: { key: SESSION_DRAFTS_STORAGE_KEY },
    })
  );
}

// ── One-time migration: localStorage → DB ───────────────────────────────────

export async function migrateLocalStorageDrafts(): Promise<void> {
  if (typeof window === "undefined") return;

  // Exercise drafts
  try {
    const raw = window.localStorage.getItem(EXERCISE_DRAFTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ExerciseDraft[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        await Promise.all(parsed.map((d) => upsertExerciseDraft(d)));
        window.localStorage.removeItem(EXERCISE_DRAFTS_STORAGE_KEY);
      }
    }
  } catch {
    window.localStorage.removeItem(EXERCISE_DRAFTS_STORAGE_KEY);
  }

  // Session drafts
  try {
    const raw = window.localStorage.getItem(SESSION_DRAFTS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionDraft[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        await Promise.all(parsed.map((d) => upsertSessionDraft(d)));
        window.localStorage.removeItem(SESSION_DRAFTS_STORAGE_KEY);
      }
    }
  } catch {
    window.localStorage.removeItem(SESSION_DRAFTS_STORAGE_KEY);
  }

  // Legacy single session draft
  try {
    const raw = window.localStorage.getItem(LEGACY_SESSION_DRAFT_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as SessionDraftPayload | null;
      if (parsed && typeof parsed === "object") {
        await upsertSessionDraft({
          id: crypto.randomUUID(),
          title: parsed.title || "Sesión sin título",
          updatedAt: new Date().toISOString(),
          payload: parsed,
        });
      }
      window.localStorage.removeItem(LEGACY_SESSION_DRAFT_STORAGE_KEY);
    }
  } catch {
    window.localStorage.removeItem(LEGACY_SESSION_DRAFT_STORAGE_KEY);
  }
}

// ── Legacy sync helpers (kept for components that haven't been refactored yet) ──

export function generateDraftId() {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function hasMeaningfulExerciseDraft(payload: ExerciseDraftPayload) {
  return Boolean(
    payload.name.trim() ||
    payload.description.trim() ||
    payload.objectives.trim() ||
    payload.tips.trim() ||
    payload.variantes.trim() ||
    payload.observaciones.trim() ||
    payload.category ||
    payload.difficulty ||
    payload.durationMinutes != null ||
    payload.location ||
    payload.videoUrl?.trim() ||
    payload.phase ||
    payload.intensity != null ||
    payload.formato ||
    payload.numJugadores != null ||
    payload.tipoPelota ||
    payload.tipoActividad ||
    payload.nivel ||
    (payload.niveles?.length ?? 0) > 0 ||
    payload.aspectoJuego ||
    (payload.aspectosJuego?.length ?? 0) > 0 ||
    payload.parametro ||
    (payload.parametros?.length ?? 0) > 0 ||
    (payload.tiposActividad?.length ?? 0) > 0 ||
    (payload.caracter?.length ?? 0) > 0 ||
    (payload.situacionJuego?.length ?? 0) > 0 ||
    payload.duracionRango ||
    payload.isGlobal ||
    payload.steps.some(
      (step) => step.title.trim() || step.description.trim()
    ) ||
    payload.materials.length > 0 ||
    payload.images.some(Boolean) ||
    payload.golpes.length > 0 ||
    payload.efecto.length > 0
  );
}

export function hasMeaningfulSessionDraft(
  payload: SessionDraftPayload,
  baseline?: SessionDraftPayload
) {
  if (!baseline) {
    return Boolean(
      payload.title.trim() ||
      payload.location.trim() ||
      payload.objective.trim() ||
      payload.intensity != null ||
      payload.tags.length > 0 ||
      payload.studentIds.length > 0 ||
      payload.exercises.length > 0
    );
  }
  return JSON.stringify(payload) !== JSON.stringify(baseline);
}
