/**
 * Motivos rápidos por los que una sesión no se dio tal y como estaba
 * planificada. Se guarda la clave en sessions.plan_change_reason.
 */
export const PLAN_CHANGE_REASONS = [
  { id: "meteorologia", label: "Tiempo o estado de la pista" },
  { id: "alumnos", label: "Faltaron alumnos o vinieron otros" },
  { id: "nivel_ritmo", label: "Nivel o ritmo del grupo" },
  { id: "tiempo", label: "Faltó tiempo" },
  { id: "material", label: "Material o pista no disponible" },
  { id: "lesion", label: "Lesión o molestias" },
  { id: "decision_monitor", label: "Decisión del monitor sobre la marcha" },
  { id: "otro", label: "Otro motivo" },
] as const;

export type PlanChangeReason = (typeof PLAN_CHANGE_REASONS)[number]["id"];

export const PLAN_CHANGE_REASON_IDS = PLAN_CHANGE_REASONS.map((r) => r.id) as [
  PlanChangeReason,
  ...PlanChangeReason[],
];

export function planChangeReasonLabel(id: string | null | undefined) {
  if (!id) return null;
  return PLAN_CHANGE_REASONS.find((r) => r.id === id)?.label ?? null;
}
