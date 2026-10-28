import { TIPO_ACTIVIDAD_LABELS } from "@/lib/exercise-taxonomy";
import type { StatAspect, StatPhase } from "@/lib/stats/training-stats";

// Etiquetas y colores de la estadística de entrenamiento, compartidos por los
// PDF (el panel de pantalla tiene su propia copia).

export const PHASE_LABEL: Record<StatPhase, string> = {
  activation: "Bloque inicial",
  main: "Bloque principal",
  cooldown: "Bloque final",
};
export const PHASE_COLOR: Record<StatPhase, string> = {
  activation: "#38BDF8",
  main: "#A3C520",
  cooldown: "#A78BFA",
};
export const ASPECT_LABEL: Record<StatAspect, string> = {
  tecnica: "Técnica",
  tactica: "Táctica",
  fisico: "Físico",
  mental: "Mental",
};
export const ASPECT_COLOR: Record<StatAspect, string> = {
  tecnica: "#2563EB",
  tactica: "#F59E0B",
  fisico: "#EC4899",
  mental: "#A78BFA",
};
export const STROKE_LABEL: Record<string, string> = {
  derecha: "Derecha",
  reves: "Revés",
  saque: "Saque",
  volea: "Volea",
  remate: "Remate",
  dejada: "Dejada",
  globo: "Globo",
  resto: "Resto",
};

export function typeLabel(key: string) {
  return (
    (TIPO_ACTIVIDAD_LABELS as Record<string, string>)[key] ??
    key.replace(/_/g, " ")
  );
}

export function formatHours(minutes: number) {
  const h = minutes / 60;
  return h >= 10 ? `${Math.round(h)} h` : `${h.toFixed(1).replace(".", ",")} h`;
}
