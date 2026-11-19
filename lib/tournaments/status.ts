// Estado del torneo. El cierre en la fecha límite se calcula al leer (sin
// cron): un torneo "open" con el plazo vencido se trata como "closed".

export type TournamentStatus =
  | "draft"
  | "open"
  | "closed"
  | "in_progress"
  | "finished";

export const TOURNAMENT_STATUSES: TournamentStatus[] = [
  "draft",
  "open",
  "closed",
  "in_progress",
  "finished",
];

type StatusInput = {
  status: TournamentStatus;
  registrationDeadline: Date | string | null;
};

export function effectiveStatus(
  t: StatusInput,
  now: Date = new Date()
): TournamentStatus {
  if (
    t.status === "open" &&
    t.registrationDeadline &&
    new Date(t.registrationDeadline).getTime() <= now.getTime()
  ) {
    return "closed";
  }
  return t.status;
}

/** Admite inscripciones por enlace (también a lista de espera). */
export const acceptsRegistrations = (t: StatusInput, now?: Date) =>
  effectiveStatus(t, now) === "open";

/** La página pública existe en todos los estados menos en borrador. */
export const isPublic = (t: StatusInput) => t.status !== "draft";

// Cambios que puede hacer el organizador. Volver atrás solo antes de
// empezar: con partidos jugados no se reabren inscripciones.
const TRANSITIONS: Record<TournamentStatus, TournamentStatus[]> = {
  draft: ["open"],
  open: ["draft", "closed"],
  closed: ["open", "in_progress"],
  in_progress: ["finished"],
  finished: ["in_progress"],
};

export function canTransition(
  t: StatusInput,
  to: TournamentStatus,
  now?: Date
): boolean {
  const from = effectiveStatus(t, now);
  if (from === to) return false;
  // Reabrir un torneo cerrado por plazo exige mover antes la fecha límite.
  if (
    to === "open" &&
    t.registrationDeadline &&
    new Date(t.registrationDeadline).getTime() <= (now ?? new Date()).getTime()
  ) {
    return false;
  }
  return TRANSITIONS[from].includes(to);
}

/**
 * Se pueden añadir o quitar participantes (desde la escuela) mientras no
 * haya cuadro: en borrador, abierto o cerrado.
 */
export const canEditEntries = (t: StatusInput, now?: Date) => {
  const s = effectiveStatus(t, now);
  return s === "draft" || s === "open" || s === "closed";
};
