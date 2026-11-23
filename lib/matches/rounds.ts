/** Rondas de un partido de torneo (para el palmarés). */
export const MATCH_ROUNDS = [
  { id: "final", label: "Final" },
  { id: "semifinal", label: "Semifinal" },
  { id: "cuartos", label: "Cuartos" },
  { id: "octavos", label: "Octavos" },
  { id: "dieciseisavos", label: "16avos" },
  { id: "grupos", label: "Fase de grupos" },
  { id: "otra", label: "Otra" },
] as const;

export type MatchRound = (typeof MATCH_ROUNDS)[number]["id"];

export const isMatchRound = (v: unknown): v is MatchRound =>
  typeof v === "string" && MATCH_ROUNDS.some((r) => r.id === v);

/** "Semifinal", o el texto libre si es «Otra»; null si no hay ronda. */
export function roundLabel(
  round: string | null | undefined,
  other: string | null | undefined
): string | null {
  if (!round) return null;
  if (round === "otra") return other?.trim() || "Otra ronda";
  return MATCH_ROUNDS.find((r) => r.id === round)?.label ?? null;
}
