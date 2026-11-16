// Motor "Monta la clase en un minuto" (F1). Puro y determinista con la
// semilla: sin red, sin base de datos, sin IA.

import {
  findCandidates,
  MAX_RELAX_STEP,
  type CandidateContext,
} from "./candidates";
import { fitDurations } from "./fit";
import { levelLabel, resolveGroupLevel, shiftLevel } from "./level";
import {
  explainAutoFocus,
  explainIntensity,
  explainLevel,
  explainRelax,
  FOCUS_LABELS,
  REPEATED_WARNING,
  SLOT_LABELS,
} from "./messages";
import { seededRandom } from "./rng";
import {
  objectiveLabels,
  parseObjectives,
  type ObjectiveFocus,
} from "./objectives";
import { pickWithSeed, scoreExercise } from "./scoring";
import { buildSkeleton, type Slot } from "./skeleton";
import type {
  EngineData,
  EngineExercise,
  Focus,
  GenerateInput,
  Golpe,
  PlanItem,
  SessionPlan,
  SlotTrace,
} from "./types";

export * from "./types";

/** Golpes entre los que elige el foco automático. */
const AUTO_GOLPES: Golpe[] = ["derecha", "reves", "saque", "volea", "resto"];

export function resolveFocus(
  focus: Focus,
  data: EngineData,
  rand: () => number,
  objectives: ObjectiveFocus = parseObjectives(null)
): {
  focus: Exclude<Focus, "auto">;
  wasAuto: boolean;
  reason?: "menos" | "turno" | "objetivos";
} {
  if (focus !== "auto") return { focus, wasAuto: false };
  // Los objetivos de la sesión mandan: el primer golpe que nombran.
  if (objectives.golpes.length > 0) {
    return { focus: objectives.golpes[0], wasAuto: true, reason: "objetivos" };
  }
  const counts = data.recentGolpeCounts ?? {};
  const anyHistory = AUTO_GOLPES.some((g) => (counts[g] ?? 0) > 0);
  if (!anyHistory) {
    const g = AUTO_GOLPES[Math.floor(rand() * AUTO_GOLPES.length)];
    return { focus: g, wasAuto: true, reason: "turno" };
  }
  const g = [...AUTO_GOLPES].sort(
    (a, b) =>
      (counts[a] ?? 0) - (counts[b] ?? 0) ||
      AUTO_GOLPES.indexOf(a) - AUTO_GOLPES.indexOf(b)
  )[0];
  return { focus: g, wasAuto: true, reason: "menos" };
}

export function generateSession(
  input: GenerateInput,
  data: EngineData
): SessionPlan {
  const rand = seededRandom(input.seed);
  const byId = new Map(data.exercises.map((e) => [e.id, e]));

  const level = resolveGroupLevel(
    data.levels,
    data.attendeeLevels,
    data.groupDefaultLevel
  );
  // El foco automático depende de la semilla base (grupo + fecha), no de la
  // variante de "Otra propuesta" ("base#2"), para que no cambie de golpe.
  const objectives = parseObjectives(input.objectives);
  const focusInfo = resolveFocus(
    input.focus,
    data,
    seededRandom(input.seed.split("#")[0]),
    objectives
  );
  const focus = focusInfo.focus;

  const slots: Slot[] = buildSkeleton(input.durationMinutes, input.intensity);
  const recent3 = new Set(data.recentSessions.slice(0, 3).flat());
  const recent8 = new Set(data.recentSessions.slice(0, 8).flat());
  const previousIds = new Set(input.previousIds ?? []);
  const pinnedBySlot = new Map(
    (input.pinned ?? [])
      .filter((p) => byId.has(p.exerciseId) && p.slotIndex < slots.length)
      .map((p) => [p.slotIndex, p])
  );
  const usedIds = new Set<string>(
    [...pinnedBySlot.values()].map((p) => p.exerciseId)
  );

  const chosen: ({
    ex: EngineExercise;
    step: number;
    pinned: boolean;
  } | null)[] = [];
  const trace: SlotTrace[] = [];
  let prev: EngineExercise | null = null;

  slots.forEach((slot, slotIndex) => {
    const pin = pinnedBySlot.get(slotIndex);
    if (pin) {
      const ex = byId.get(pin.exerciseId)!;
      chosen.push({ ex, step: 0, pinned: true });
      trace.push({
        slotIndex,
        kind: slot.kind,
        targetMinutes: slot.minutes,
        relaxStep: 0,
        candidates: 1,
        top: [{ id: ex.id, score: 0 }],
      });
      prev = ex;
      return;
    }

    const adjust =
      input.slotAdjust?.slotIndex === slotIndex ? input.slotAdjust : undefined;
    const slotLevel = adjust?.levelShift
      ? shiftLevel(data.levels, level.code, adjust.levelShift)
      : level.code;
    const ctx: CandidateContext = {
      levels: data.levels,
      level: slotLevel,
      focus,
      attendees: Math.max(1, input.attendeeIds.length),
      usedIds,
      excludeIds: new Set(adjust?.excludeIds ?? []),
      recent3,
    };
    const { step, list } = findCandidates(data.exercises, slot, ctx);
    const scored = list.map((ex) => ({
      ex,
      score: scoreExercise(ex, slot, {
        level: slotLevel,
        focus,
        intensity: input.intensity,
        recent3,
        recent8,
        previousIds,
        prev,
        objectives,
      }),
    }));
    const pick = pickWithSeed(scored, rand);
    trace.push({
      slotIndex,
      kind: slot.kind,
      targetMinutes: slot.minutes,
      relaxStep: step,
      candidates: list.length,
      top: [...scored]
        .sort((a, b) => b.score - a.score)
        .slice(0, 5)
        .map((s) => ({ id: s.ex.id, score: Math.round(s.score * 100) / 100 })),
    });
    if (!pick) {
      chosen.push(null);
      return;
    }
    usedIds.add(pick.ex.id);
    chosen.push({ ex: pick.ex, step, pinned: false });
    prev = pick.ex;
  });

  // Ajuste de minutos (los huecos vacíos ceden su tiempo al resto).
  const filled = slots
    .map((slot, i) => ({ slot, i, c: chosen[i] }))
    .filter(
      (
        x
      ): x is {
        slot: Slot;
        i: number;
        c: NonNullable<(typeof chosen)[number]>;
      } => x.c !== null
    );
  const minutes = fitDurations(
    filled.map(({ slot, i, c }) => ({
      target: slot.minutes,
      exerciseMinutes: c.ex.durationMinutes,
      pinned: c.pinned,
      fixedMinutes: c.pinned ? pinnedBySlot.get(i)?.minutes : undefined,
      isPuntos: slot.kind === "puntos",
    })),
    input.durationMinutes
  );

  const items: PlanItem[] = filled.map(({ slot, i, c }, k) => ({
    slotIndex: i,
    kind: slot.kind,
    phase: slot.phase,
    exerciseId: c.ex.id,
    name: c.ex.name,
    minutes: minutes[k],
    pinned: c.pinned,
    relaxStep: c.step,
  }));

  // Dos pistas: cada hueco del bloque principal (pista 1, con monitor) recibe
  // una pareja en la pista 2 (autónoma) del mismo tiempo, tomada entre los
  // ejercicios competitivos (juego/puntos), que no necesitan al monitor, y
  // pensada para la mitad del grupo. La duración total es la de la pista 1.
  let totalMinutes = items.reduce((n, it) => n + it.minutes, 0);
  const secondLane: PlanItem[] = [];
  const partnerOf = new Map<PlanItem, PlanItem>();
  if (input.courts === 2) {
    const half = Math.max(1, Math.ceil(input.attendeeIds.length / 2));
    let nextSlot = slots.length;
    for (const it of items.filter((x) => x.phase === "main")) {
      it.court = 1;
      it.ledBy = "coach";
      const slot: Slot = { kind: "puntos", phase: "main", minutes: it.minutes };
      const ctx: CandidateContext = {
        levels: data.levels,
        level: level.code,
        focus,
        attendees: half,
        usedIds,
        excludeIds: new Set(),
        recent3,
      };
      const { step, list } = findCandidates(data.exercises, slot, ctx);
      const scored = list.map((ex) => ({
        ex,
        score: scoreExercise(ex, slot, {
          level: level.code,
          focus,
          intensity: input.intensity,
          recent3,
          recent8,
          previousIds,
          prev: null,
          objectives,
        }),
      }));
      const pick = pickWithSeed(scored, rand);
      if (!pick) continue;
      usedIds.add(pick.ex.id);
      const partner: PlanItem = {
        slotIndex: nextSlot++,
        kind: "puntos",
        phase: "main",
        exerciseId: pick.ex.id,
        name: pick.ex.name,
        minutes: it.minutes,
        pinned: false,
        relaxStep: step,
        court: 2,
        ledBy: "auto",
      };
      secondLane.push(partner);
      partnerOf.set(it, partner);
    }
  }

  // Con rotación, los dos grupos hacen las dos pistas: los minutos del bloque
  // principal pasan a ser por grupo (la mitad) y el bloque dura el doble.
  const rotatesMain =
    input.courts === 2 && input.rotate === true && secondLane.length > 0;
  if (rotatesMain) {
    const mains = items.filter((x) => x.phase === "main");
    // Mitad de cada hueco, repartiendo el redondeo (primero a los impares)
    // para que el bloque dure lo que durarían los huecos sin rotar.
    const halves = mains.map((it) => Math.max(2, Math.floor(it.minutes / 2)));
    let spare =
      Math.round(mains.reduce((n, it) => n + it.minutes, 0) / 2) -
      halves.reduce((n, h) => n + h, 0);
    const order = mains
      .map((it, i) => i)
      .sort((x, y) => (mains[y].minutes % 2) - (mains[x].minutes % 2));
    for (let k = 0; spare > 0 && k < order.length * 2; k++, spare--) {
      halves[order[k % order.length]] += 1;
    }
    mains.forEach((it, i) => {
      it.minutes = halves[i];
      const partner = partnerOf.get(it);
      if (partner) partner.minutes = halves[i];
    });
    const mainLane1 = items
      .filter((x) => x.phase === "main")
      .reduce((n, it) => n + it.minutes, 0);
    totalMinutes =
      items
        .filter((x) => x.phase !== "main")
        .reduce((n, it) => n + it.minutes, 0) +
      mainLane1 * 2;
  }

  const repeatedRecent = items.some(
    (it) => !it.pinned && recent3.has(it.exerciseId)
  );
  const explanations: string[] = [];
  if (focusInfo.wasAuto) {
    explanations.push(
      explainAutoFocus(FOCUS_LABELS[focus], focusInfo.reason ?? "turno")
    );
  }
  const understood = objectiveLabels(objectives);
  if (understood.length > 0) {
    explanations.push(`Por tus objetivos: ${understood.join(", ")}.`);
  }
  explanations.push(
    explainLevel(levelLabel(data.levels, level.code), level.source)
  );
  if (input.intensity !== "media")
    explanations.push(explainIntensity(input.intensity));
  for (const it of items) {
    if (it.relaxStep > 0 && it.relaxStep <= MAX_RELAX_STEP) {
      explanations.push(explainRelax(SLOT_LABELS[it.kind], it.relaxStep));
    }
  }
  if (repeatedRecent) explanations.push(REPEATED_WARNING);
  if (secondLane.length > 0) {
    explanations.push(
      rotatesMain
        ? "Dos pistas con rotación: el grupo se parte en dos y cada mitad hace las dos pistas (con el monitor y por su cuenta); los minutos del bloque principal son por grupo y rotan a mitad."
        : "Dos pistas: en la pista 1 trabajas con el monitor y en la pista 2 el grupo juega por su cuenta, con el mismo tiempo."
    );
  }

  return {
    durationMinutes: totalMinutes,
    groupLevel: level.code,
    levelSource: level.source,
    focus,
    focusWasAuto: focusInfo.wasAuto,
    items: [...items, ...secondLane],
    rotatesMain,
    explanations,
    repeatedRecent,
    trace,
  };
}
