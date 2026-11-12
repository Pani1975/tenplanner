// Tipos del motor "Monta la clase en un minuto" (F1, docs/f1-plan.md).
// El motor es puro: recibe los datos ya cargados (EngineData) y no hace
// llamadas de red, de base de datos ni de IA.

import type { SkillLevel } from "@/lib/skill-levels";

export const GOLPES = [
  "derecha",
  "reves",
  "saque",
  "resto",
  "volea",
  "remate",
  "globo",
  "dejada",
] as const;
export type Golpe = (typeof GOLPES)[number];

export type Phase = "activation" | "main" | "cooldown";
export type Intensity = "suave" | "media" | "alta";
export type Focus = "auto" | Golpe | "tactica" | "fisico";
/** Minutos de la sesión (la del calendario; antes solo 30/45/60/90). */
export type Duration = number;
export const DURATIONS: readonly Duration[] = [30, 45, 60, 90];

/** Papel de cada hueco de la clase. */
export type SlotKind =
  | "activation"
  | "tecnica"
  | "tactica"
  | "puntos"
  | "cooldown";

export type EngineExercise = {
  id: string;
  name: string;
  durationMinutes: number;
  fases: string[];
  niveles: string[];
  golpes: string[];
  caracter: string[];
  aspectos: string[];
  tipoActividad: string | null;
  tipoPelota: string | null;
  numJugadores: number | null;
  hasSteps: boolean;
  hasVariantes: boolean;
  hasMedia: boolean;
  /** Media de exercise_ratings (1-5) o null. */
  ratingAvg: number | null;
};

export type GenerateInput = {
  groupId: string;
  durationMinutes: Duration;
  intensity: Intensity;
  focus: Focus;
  /** Alumnos que vienen hoy (por defecto, todos los del grupo). */
  attendeeIds: string[];
  /** Objetivos de la sesión (texto, uno por línea): orientan la propuesta. */
  objectives?: string | null;
  /** Ejercicios fijados: "Otra propuesta" no los toca. */
  pinned?: { slotIndex: number; exerciseId: string; minutes?: number }[];
  /** Ejercicios de la propuesta anterior, para que "Otra propuesta" cambie. */
  previousIds?: string[];
  /** Ajuste de un hueco: más fácil/difícil o cambiar. */
  slotAdjust?: {
    slotIndex: number;
    levelShift?: -1 | 0 | 1;
    excludeIds?: string[];
  };
  seed: string;
};

export type EngineData = {
  sport: string;
  levels: SkillLevel[];
  /** player_level de cada alumno que viene (null = sin nivel). */
  attendeeLevels: (string | null)[];
  groupDefaultLevel: string | null;
  exercises: EngineExercise[];
  /**
   * Ejercicios de las últimas sesiones completadas del grupo, de la más
   * reciente a la más antigua (máximo 8).
   */
  recentSessions: string[][];
  /** Golpes trabajados en esas sesiones, para el foco automático. */
  recentGolpeCounts?: Partial<Record<Golpe, number>>;
};

export type LevelSource = "asistentes" | "grupo" | "defecto";

export type PlanItem = {
  slotIndex: number;
  kind: SlotKind;
  phase: Phase;
  exerciseId: string;
  name: string;
  minutes: number;
  pinned: boolean;
  /** Pasos de relajación que hicieron falta (0 = ninguno). */
  relaxStep: number;
};

export type SessionPlan = {
  durationMinutes: number;
  groupLevel: string;
  levelSource: LevelSource;
  focus: Exclude<Focus, "auto">;
  focusWasAuto: boolean;
  items: PlanItem[];
  /** Frases en castellano que explican las decisiones. */
  explanations: string[];
  /** true si algún hueco tuvo que repetir un ejercicio reciente. */
  repeatedRecent: boolean;
  trace: SlotTrace[];
};

export type SlotTrace = {
  slotIndex: number;
  kind: SlotKind;
  targetMinutes: number;
  relaxStep: number;
  candidates: number;
  top: { id: string; score: number }[];
};
