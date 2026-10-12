export type TrainingPhase = "activation" | "main" | "cooldown";
export type ExerciseCategory = "technique" | "tactics" | "fitness" | "warm-up";
export type ExerciseDifficulty = "beginner" | "intermediate" | "advanced";
/** Aspectos del juego con los que se etiquetan los ejercicios. */
export type ExerciseAspect = "tecnica" | "tactica" | "fisico" | "mental";

export interface AnalyticsExerciseInput {
  orderIndex: number;
  durationMinutes: number;
  category: string;
  difficulty: string;
  resolvedPhase: TrainingPhase;
  resolvedIntensity: number | null;
  name: string;
  /** Aspectos del juego del ejercicio (etiquetas de la biblioteca). */
  aspectos?: string[] | null;
}

export interface AspectBreakdown {
  aspect: ExerciseAspect;
  minutes: number;
}

export interface PhaseBreakdown {
  phase: TrainingPhase;
  minutes: number;
  percentage: number;
}

export interface PhaseTarget {
  phase: TrainingPhase;
  targetPct: number;
  actualPct: number;
  actualMinutes: number;
  deltaPct: number;
}

export interface CategoryBreakdown {
  category: ExerciseCategory;
  minutes: number;
}

export interface DifficultyBreakdown {
  difficulty: ExerciseDifficulty;
  minutes: number;
  percentage: number;
}

export interface IntensityPoint {
  order: number;
  cumulativeMinutes: number;
  midpointMinutes: number;
  intensity: number | null;
  name: string;
  phase: TrainingPhase;
  durationMinutes: number;
}

export interface SessionAnalytics {
  totalMinutes: number;
  exerciseCount: number;
  averageIntensity: number | null;
  weightedAverageIntensity: number | null;
  peakIntensity: number | null;
  peakPositionPct: number | null;
  peakExerciseName: string | null;
  trainingLoad: number;
  densityScore: number | null;
  phasesCovered: number;
  balanceScore: number;
  studentCount: number;
  tagCount: number;
  phaseBreakdown: PhaseBreakdown[];
  phaseTargets: PhaseTarget[];
  categoryBreakdown: CategoryBreakdown[];
  /** Minutos por aspecto del juego, sacados de las etiquetas de los ejercicios. */
  aspectBreakdown: AspectBreakdown[];
  difficultyBreakdown: DifficultyBreakdown[];
  intensityCurve: IntensityPoint[];
}

const ALL_PHASES: TrainingPhase[] = ["activation", "main", "cooldown"];
const ALL_ASPECTS: ExerciseAspect[] = ["tecnica", "tactica", "fisico", "mental"];
// Si un ejercicio no tiene aspectos etiquetados se usa su categoría.
const CATEGORY_TO_ASPECT: Record<string, ExerciseAspect> = {
  technique: "tecnica",
  tactics: "tactica",
  fitness: "fisico",
  "warm-up": "fisico",
};
const ALL_CATEGORIES: ExerciseCategory[] = [
  "warm-up",
  "technique",
  "tactics",
  "fitness",
];
const ALL_DIFFICULTIES: ExerciseDifficulty[] = [
  "beginner",
  "intermediate",
  "advanced",
];

// Objetivos de distribución por fase para una sesión equilibrada
const PHASE_TARGETS: Record<TrainingPhase, number> = {
  activation: 15,
  main: 70,
  cooldown: 15,
};

export function resolvePhase(
  overridePhase: string | null | undefined,
  exercisePhase: string | null | undefined
): TrainingPhase {
  const value = overridePhase ?? exercisePhase ?? "main";
  if (value === "activation" || value === "main" || value === "cooldown") {
    return value;
  }
  return "main";
}

export function resolveIntensity(
  overrideIntensity: number | null | undefined,
  exerciseIntensity: number | null | undefined
): number | null {
  return overrideIntensity ?? exerciseIntensity ?? null;
}

export function computeSessionAnalytics(
  exercises: AnalyticsExerciseInput[],
  studentCount: number,
  tagCount: number
): SessionAnalytics {
  const sorted = [...exercises].sort((a, b) => a.orderIndex - b.orderIndex);
  const totalMinutes = sorted.reduce((s, e) => s + e.durationMinutes, 0);

  // ── Fases ───────────────────────────────────────────────
  const phaseMinutes = new Map<TrainingPhase, number>();
  for (const phase of ALL_PHASES) phaseMinutes.set(phase, 0);
  for (const ex of sorted) {
    phaseMinutes.set(
      ex.resolvedPhase,
      (phaseMinutes.get(ex.resolvedPhase) ?? 0) + ex.durationMinutes
    );
  }

  const phaseBreakdown: PhaseBreakdown[] = ALL_PHASES.map((phase) => {
    const minutes = phaseMinutes.get(phase) ?? 0;
    return {
      phase,
      minutes,
      percentage: totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0,
    };
  });

  const phaseTargets: PhaseTarget[] = ALL_PHASES.map((phase) => {
    const minutes = phaseMinutes.get(phase) ?? 0;
    const actualPct = totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0;
    const targetPct = PHASE_TARGETS[phase];
    return {
      phase,
      targetPct,
      actualPct,
      actualMinutes: minutes,
      deltaPct: actualPct - targetPct,
    };
  });

  // ── Categorías ──────────────────────────────────────────
  const categoryMinutes = new Map<ExerciseCategory, number>();
  for (const cat of ALL_CATEGORIES) categoryMinutes.set(cat, 0);
  for (const ex of sorted) {
    const cat = ALL_CATEGORIES.includes(ex.category as ExerciseCategory)
      ? (ex.category as ExerciseCategory)
      : null;
    if (cat) {
      categoryMinutes.set(
        cat,
        (categoryMinutes.get(cat) ?? 0) + ex.durationMinutes
      );
    }
  }
  const categoryBreakdown: CategoryBreakdown[] = ALL_CATEGORIES.map((c) => ({
    category: c,
    minutes: categoryMinutes.get(c) ?? 0,
  }));
  const categoriesCovered = categoryBreakdown.filter(
    (c) => c.minutes > 0
  ).length;
  const balanceScore = Math.round(
    (categoriesCovered / ALL_CATEGORIES.length) * 100
  );

  // ── Aspectos del juego ──────────────────────────────────
  // Los minutos de cada ejercicio se reparten a partes iguales entre sus
  // aspectos, para que la suma coincida con la duración total.
  const aspectMinutes = new Map<ExerciseAspect, number>();
  for (const aspect of ALL_ASPECTS) aspectMinutes.set(aspect, 0);
  for (const ex of sorted) {
    let aspects = (ex.aspectos ?? []).filter((a): a is ExerciseAspect =>
      ALL_ASPECTS.includes(a as ExerciseAspect)
    );
    if (aspects.length === 0) {
      const fallback = CATEGORY_TO_ASPECT[ex.category];
      aspects = fallback ? [fallback] : [];
    }
    for (const aspect of aspects) {
      aspectMinutes.set(
        aspect,
        (aspectMinutes.get(aspect) ?? 0) + ex.durationMinutes / aspects.length
      );
    }
  }
  const aspectBreakdown: AspectBreakdown[] = ALL_ASPECTS.map((aspect) => ({
    aspect,
    minutes: Math.round((aspectMinutes.get(aspect) ?? 0) * 10) / 10,
  }));

  // ── Dificultad ──────────────────────────────────────────
  const difficultyMinutes = new Map<ExerciseDifficulty, number>();
  for (const d of ALL_DIFFICULTIES) difficultyMinutes.set(d, 0);
  for (const ex of sorted) {
    const d = ALL_DIFFICULTIES.includes(ex.difficulty as ExerciseDifficulty)
      ? (ex.difficulty as ExerciseDifficulty)
      : null;
    if (d) {
      difficultyMinutes.set(
        d,
        (difficultyMinutes.get(d) ?? 0) + ex.durationMinutes
      );
    }
  }
  const difficultyBreakdown: DifficultyBreakdown[] = ALL_DIFFICULTIES.map(
    (d) => {
      const minutes = difficultyMinutes.get(d) ?? 0;
      return {
        difficulty: d,
        minutes,
        percentage: totalMinutes > 0 ? (minutes / totalMinutes) * 100 : 0,
      };
    }
  );

  // ── Curva de intensidad ─────────────────────────────────
  let cumulative = 0;
  const intensityCurve: IntensityPoint[] = sorted.map((ex, idx) => {
    const start = cumulative;
    cumulative += ex.durationMinutes;
    return {
      order: idx + 1,
      cumulativeMinutes: cumulative,
      midpointMinutes: start + ex.durationMinutes / 2,
      intensity: ex.resolvedIntensity,
      name: ex.name,
      phase: ex.resolvedPhase,
      durationMinutes: ex.durationMinutes,
    };
  });

  // ── Métricas agregadas de intensidad ────────────────────
  const withIntensity = sorted.filter(
    (e) => typeof e.resolvedIntensity === "number"
  );
  const intensities = withIntensity.map((e) => e.resolvedIntensity as number);
  const averageIntensity =
    intensities.length > 0
      ? intensities.reduce((s, v) => s + v, 0) / intensities.length
      : null;

  // Training Load = Σ(minutes × intensity). Métrica estilo TRIMP simplificado.
  const trainingLoad = withIntensity.reduce(
    (sum, e) => sum + e.durationMinutes * (e.resolvedIntensity as number),
    0
  );

  const weightedMinutes = withIntensity.reduce(
    (s, e) => s + e.durationMinutes,
    0
  );
  const weightedAverageIntensity =
    weightedMinutes > 0 ? trainingLoad / weightedMinutes : null;

  // Densidad = carga real / carga máxima teórica (intensidad=5 todo el tiempo medido)
  const densityScore =
    weightedMinutes > 0 ? (trainingLoad / (weightedMinutes * 5)) * 100 : null;

  // Pico
  let peakIntensity: number | null = null;
  let peakPositionPct: number | null = null;
  let peakExerciseName: string | null = null;
  if (withIntensity.length > 0 && totalMinutes > 0) {
    const peakPoint = intensityCurve
      .filter((p) => p.intensity !== null)
      .reduce<IntensityPoint | null>((best, p) => {
        if (!best || (p.intensity ?? 0) > (best.intensity ?? 0)) return p;
        return best;
      }, null);
    if (peakPoint) {
      peakIntensity = peakPoint.intensity;
      peakPositionPct = (peakPoint.midpointMinutes / totalMinutes) * 100;
      peakExerciseName = peakPoint.name;
    }
  }

  const phasesCovered = phaseBreakdown.filter((p) => p.minutes > 0).length;

  return {
    totalMinutes,
    exerciseCount: sorted.length,
    averageIntensity,
    weightedAverageIntensity,
    peakIntensity,
    peakPositionPct,
    peakExerciseName,
    trainingLoad,
    densityScore,
    phasesCovered,
    balanceScore,
    studentCount,
    tagCount,
    phaseBreakdown,
    phaseTargets,
    categoryBreakdown,
    aspectBreakdown,
    difficultyBreakdown,
    intensityCurve,
  };
}
