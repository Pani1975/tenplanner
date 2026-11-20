// Categorías de torneo (sustituyen al nivel). El organizador elige una de la
// lista o escribe otra («Otro»).

export const TOURNAMENT_CATEGORIES = [
  "Benjamín",
  "Alevín",
  "Infantil",
  "Cadete",
  "Junior",
  "Absoluto",
  "+35",
  "+40",
  "+45",
  "+50",
  "+55",
  "+60",
] as const;

export const isPresetCategory = (c: string | null | undefined) =>
  !!c && (TOURNAMENT_CATEGORIES as readonly string[]).includes(c);
