/**
 * Mis partidos: tipos, reglas por tipo y validación. Se usa igual en el
 * formulario (errores bajo cada campo) y en la API (la que manda).
 *
 * Tres tipos (decisión de David, 2026-11-23, migración 0117_match_types):
 * - Torneo federado: resultado obligatorio; torneo, enlace y rival (nombre,
 *   apellidos, licencia) opcionales.
 * - Torneo no federado: igual, pero sin licencia del rival.
 * - Entrenamiento: todo opcional salvo la fecha; sin torneo, enlace ni
 *   licencia.
 */

export const MATCH_TYPES = [
  "torneo_federado",
  "torneo_no_federado",
  "entrenamiento",
] as const;

export type MatchType = (typeof MATCH_TYPES)[number];

/** Valores que puede tener la base: "partido_oficial" quedó sin uso. */
export type StoredMatchType = MatchType | "partido_oficial";

export const MATCH_TYPE_LABELS: Record<StoredMatchType, string> = {
  torneo_federado: "Torneo federado",
  torneo_no_federado: "Torneo no federado",
  entrenamiento: "Entrenamiento",
  partido_oficial: "Partido oficial",
};

export function isMatchType(value: unknown): value is MatchType {
  return (
    typeof value === "string" && (MATCH_TYPES as readonly string[]).includes(value)
  );
}

/** Qué campos admite cada tipo y cuáles son obligatorios. */
export const MATCH_TYPE_RULES: Record<
  MatchType,
  {
    resultRequired: boolean;
    url: boolean;
    urlLabel: string;
    license: boolean;
    rivalFirstNameRequired: boolean;
  }
> = {
  torneo_federado: {
    resultRequired: true,
    url: true,
    urlLabel: "Enlace del torneo",
    license: true,
    rivalFirstNameRequired: false,
  },
  torneo_no_federado: {
    resultRequired: true,
    url: true,
    urlLabel: "Enlace del torneo",
    license: false,
    rivalFirstNameRequired: false,
  },
  entrenamiento: {
    resultRequired: false,
    url: false,
    urlLabel: "",
    license: false,
    rivalFirstNameRequired: false,
  },
};

export const MATCH_LIMITS = {
  name: 80,
  tournament: 120,
  license: 40,
  url: 500,
  result: 60,
} as const;

/** Lo que llega del formulario o de la API (todo texto). */
export interface MatchInput {
  matchType?: unknown;
  matchDate?: unknown;
  finalResult?: unknown;
  tournamentUrl?: unknown;
  tournamentName?: unknown;
  showOnProfile?: unknown;
  rivalFirstName?: unknown;
  rivalLastName?: unknown;
  rivalLicense?: unknown;
}

/** Lo que se guarda: los campos que no admite el tipo quedan a null. */
export interface MatchData {
  matchType: MatchType;
  matchDate: string;
  finalResult: string | null;
  tournamentUrl: string | null;
  /** Nombre del torneo (no en Entrenamiento). Sale en el perfil público. */
  tournamentName: string | null;
  /** Mostrar en el perfil público del jugador (nunca el rival). */
  showOnProfile: boolean;
  rivalFirstName: string | null;
  rivalLastName: string | null;
  rivalLicense: string | null;
}

export type MatchField = keyof MatchData;

export type MatchValidation =
  | { ok: true; data: MatchData }
  | { ok: false; errors: Partial<Record<MatchField, string>> };

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

// Un set: "6-4", "7-6(5)" o "10-8" (super tie-break). Entre 1 y 5 sets,
// separados por espacios o comas.
const SET_RE = /^\d{1,2}-\d{1,2}(\(\d{1,2}\))?$/;

/**
 * Normaliza un resultado ("6-4,3-6  10-8" → "6-4 3-6 10-8"). Devuelve null
 * si el formato no es válido. Solo comprueba el formato, no si el marcador
 * es posible en tenis.
 */
export function normalizeResult(raw: string): string | null {
  const sets = raw
    .replace(/[–—]/g, "-")
    .split(/[\s,;]+/)
    .filter(Boolean);
  if (sets.length < 1 || sets.length > 5) return null;
  if (!sets.every((s) => SET_RE.test(s))) return null;
  return sets.join(" ");
}

function isValidDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

function isValidUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Valida un partido. `today` es la fecha de hoy (AAAA-MM-DD) en España: la
 * fecha del partido no puede ser posterior.
 */
export function validateMatch(input: MatchInput, today: string): MatchValidation {
  const errors: Partial<Record<MatchField, string>> = {};

  if (!isMatchType(input.matchType)) {
    errors.matchType = "Elige el tipo de partido.";
    return { ok: false, errors };
  }
  const matchType = input.matchType;
  const rules = MATCH_TYPE_RULES[matchType];

  const matchDate = text(input.matchDate);
  if (!matchDate) errors.matchDate = "Indica la fecha del partido.";
  else if (!isValidDate(matchDate)) errors.matchDate = "La fecha no es válida.";
  else if (matchDate > today)
    errors.matchDate = "La fecha no puede ser posterior a hoy.";

  const rawResult = text(input.finalResult);
  let finalResult: string | null = null;
  if (!rawResult) {
    if (rules.resultRequired) errors.finalResult = "Indica el resultado final.";
  } else if (rawResult.length > MATCH_LIMITS.result) {
    errors.finalResult = "El resultado es demasiado largo.";
  } else {
    finalResult = normalizeResult(rawResult);
    if (!finalResult)
      errors.finalResult =
        "Escribe el resultado por sets, separados por espacios. Ejemplo: 6-4 3-6 10-8";
  }

  let tournamentUrl: string | null = null;
  if (rules.url) {
    const url = text(input.tournamentUrl);
    if (url) {
      if (url.length > MATCH_LIMITS.url || !isValidUrl(url))
        errors.tournamentUrl =
          "El enlace no es válido. Debe empezar por http:// o https://";
      else tournamentUrl = url;
    }
  }

  let tournamentName: string | null = null;
  if (rules.url) {
    const name = text(input.tournamentName);
    if (name.length > MATCH_LIMITS.tournament)
      errors.tournamentName = "El nombre del torneo es demasiado largo.";
    else tournamentName = name || null;
  }

  const rivalFirstName = text(input.rivalFirstName);
  if (!rivalFirstName && rules.rivalFirstNameRequired)
    errors.rivalFirstName = "Indica el nombre del rival.";
  else if (rivalFirstName.length > MATCH_LIMITS.name)
    errors.rivalFirstName = "El nombre es demasiado largo.";

  const rivalLastName = text(input.rivalLastName);
  if (rivalLastName.length > MATCH_LIMITS.name)
    errors.rivalLastName = "Los apellidos son demasiado largos.";

  let rivalLicense: string | null = null;
  if (rules.license) {
    const license = text(input.rivalLicense);
    if (license.length > MATCH_LIMITS.license)
      errors.rivalLicense = "La licencia es demasiado larga.";
    else rivalLicense = license || null;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      matchType,
      matchDate,
      finalResult,
      tournamentUrl,
      tournamentName,
      showOnProfile: input.showOnProfile === true,
      rivalFirstName: rivalFirstName || null,
      rivalLastName: rivalLastName || null,
      rivalLicense,
    },
  };
}

/** Fecha de hoy (AAAA-MM-DD) en España. */
export function todayInSpain(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** "Nombre Apellidos" del rival, o null si no hay. */
export function rivalName(m: {
  rivalFirstName: string | null;
  rivalLastName: string | null;
}): string | null {
  const name = [m.rivalFirstName, m.rivalLastName].filter(Boolean).join(" ");
  return name || null;
}
