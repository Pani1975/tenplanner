import type { PickerTaggedExercise } from "@/components/app/exercise-picker-filters";
import type { StationDraftItem } from "@/lib/block-items";

export type TrainingPhase = "activation" | "main" | "cooldown";

export interface AvailableExercise extends PickerTaggedExercise {
  id: string;
  name: string;
  category: string;
  difficulty: string;
  durationMinutes: number;
  description?: string | null;
}

export interface StudentOption {
  id: string;
  name: string;
  imageUrl?: string | null;
  playerLevel?: string | null;
}

export interface WizardExercise {
  /**
   * Para ejercicios de la biblioteca, su id. Para textos libres,
   * descansos y estaciones, una clave local que empieza por "text-",
   * "warmup-" o "stations-" (nunca se envía al servidor como id).
   */
  exerciseId: string;
  /**
   * "text" = texto libre; "warmup" = descanso (solo duración);
   * "stations" = 2-10 estaciones (cada una ejercicio o texto).
   */
  kind?: "exercise" | "text" | "warmup" | "stations";
  freeText?: string;
  /**
   * Título corto del item (solo kind "text"), mostrado en negrita igual
   * que el nombre de un ejercicio de biblioteca. Opcional: una anotación
   * puede ir sin título.
   */
  title?: string;
  /** Solo para kind "stations". */
  stations?: StationDraftItem[];
  name: string;
  category: string;
  durationMinutes: number;
  overrideDuration: number | null;
  notes: string;
  phase: TrainingPhase | null;
  intensity: number | null;
}

export interface WizardBlockItem {
  kind?: "exercise" | "text" | "warmup" | "stations";
  exerciseId?: string | null;
  freeText?: string | null;
  title?: string | null;
  durationMinutes?: number | null;
  notes?: string | null;
  stations?: StationDraftItem[] | null;
}

export interface WizardSessionBlock {
  orderIndex: 1 | 2 | 3;
  title: string;
  notes: string;
  items: WizardBlockItem[];
}

export type WizardRecurrenceFrequency = "weekly";

export interface WizardRecurrence {
  enabled: boolean;
  frequency: WizardRecurrenceFrequency;
  weeks: number; // total weeks including the original
  weekdays: number[]; // 0=Sun..6=Sat (multi-select)
  /** "weeks" = durante N semanas; "until" = hasta una fecha (fin de curso). */
  mode?: "weeks" | "until";
  /** Fecha final (YYYY-MM-DD), incluida. */
  until?: string;
}

export interface WizardState {
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
  exercises: WizardExercise[];
  blocks: WizardSessionBlock[];
  recurrence: WizardRecurrence;
  /** Nombre del grupo para el código de la sesión (AAMMDD_Grupo). */
  groupName?: string;
  /** Si está activo, cada sesión se llama AAMMDD_Grupo según su fecha. */
  useCodeTitle?: boolean;
}

export interface WizardPlace {
  id: string;
  name: string;
}

export const LOCATION_OPTIONS = [
  "Pista/cancha cubierta",
  "Pista/cancha exterior",
  "Muro o pared",
  "Otro",
] as const;

export const PHASE_LABELS: Record<TrainingPhase, string> = {
  activation: "Bloque inicial",
  main: "Bloque principal",
  cooldown: "Bloque final",
};
