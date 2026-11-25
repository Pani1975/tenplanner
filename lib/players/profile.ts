import { isAdult } from "@/lib/age";

/**
 * Perfil del jugador: validación (formulario y API) y lo que se publica.
 * Independiente de la ficha de alumno del club.
 */

export const HANDS = [
  { id: "right", label: "Diestro" },
  { id: "left", label: "Zurdo" },
] as const;

export const handLabel = (id: string | null) =>
  HANDS.find((h) => h.id === id)?.label ?? null;

export interface ProfileInput {
  firstName?: unknown;
  lastName?: unknown;
  birthDate?: unknown;
  showPhoto?: unknown;
  clubName?: unknown;
  dominantHand?: unknown;
  startedAge?: unknown;
  favoritePlayer?: unknown;
  birthPlace?: unknown;
  isPublic?: unknown;
}

export interface ProfileData {
  firstName: string;
  lastName: string;
  birthDate: string | null;
  showPhoto: boolean;
  clubName: string | null;
  dominantHand: string | null;
  startedAge: number | null;
  favoritePlayer: string | null;
  birthPlace: string | null;
  isPublic: boolean;
}

export type ProfileField = keyof ProfileData;

export type ProfileValidation =
  | { ok: true; data: ProfileData }
  | { ok: false; errors: Partial<Record<ProfileField, string>> };

const text = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function optionalText(
  v: unknown,
  max: number,
  field: ProfileField,
  errors: Partial<Record<ProfileField, string>>
): string | null {
  const t = text(v);
  if (t.length > max) errors[field] = `Máximo ${max} caracteres.`;
  return t || null;
}

/**
 * `today` en AAAA-MM-DD (España). Un perfil público exige fecha de
 * nacimiento de mayor de edad: los menores no pueden tener perfil público.
 */
export function validateProfile(
  input: ProfileInput,
  today: string
): ProfileValidation {
  const errors: Partial<Record<ProfileField, string>> = {};

  const firstName = text(input.firstName);
  if (!firstName) errors.firstName = "Indica tu nombre.";
  else if (firstName.length > 80) errors.firstName = "Máximo 80 caracteres.";

  const lastName = text(input.lastName);
  if (!lastName) errors.lastName = "Indica tus apellidos.";
  else if (lastName.length > 120) errors.lastName = "Máximo 120 caracteres.";

  const birthRaw = text(input.birthDate);
  let birthDate: string | null = null;
  if (birthRaw) {
    const d = new Date(`${birthRaw}T00:00:00Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(birthRaw) ||
      Number.isNaN(d.getTime()) ||
      d.toISOString().slice(0, 10) !== birthRaw
    )
      errors.birthDate = "La fecha no es válida.";
    else if (birthRaw > today)
      errors.birthDate = "La fecha no puede ser posterior a hoy.";
    else if (Number(birthRaw.slice(0, 4)) < 1900)
      errors.birthDate = "La fecha no es válida.";
    else birthDate = birthRaw;
  }

  const hand = text(input.dominantHand);
  if (hand && !HANDS.some((h) => h.id === hand))
    errors.dominantHand = "Elige una opción de la lista.";

  let startedAge: number | null = null;
  const ageRaw =
    typeof input.startedAge === "number"
      ? String(input.startedAge)
      : text(input.startedAge);
  if (ageRaw) {
    const n = Number(ageRaw);
    if (!Number.isInteger(n) || n < 2 || n > 90)
      errors.startedAge = "Indica una edad entre 2 y 90 años.";
    else startedAge = n;
  }

  const clubName = optionalText(input.clubName, 120, "clubName", errors);
  const favoritePlayer = optionalText(
    input.favoritePlayer,
    80,
    "favoritePlayer",
    errors
  );
  const birthPlace = optionalText(input.birthPlace, 120, "birthPlace", errors);

  const isPublic = input.isPublic === true;
  if (isPublic && !errors.birthDate) {
    if (!birthDate)
      errors.isPublic =
        "Para hacer público tu perfil, indica tu fecha de nacimiento.";
    else if (!isAdult(birthDate, new Date(`${today}T12:00:00Z`)))
      errors.isPublic = "Los menores de 18 años no pueden tener perfil público.";
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    data: {
      firstName,
      lastName,
      birthDate,
      showPhoto: input.showPhoto === true,
      clubName,
      dominantHand: hand || null,
      startedAge,
      favoritePlayer,
      birthPlace,
      isPublic,
    },
  };
}

/** "Ana García López" → "ana-garcia-lopez" (sin acentos ni símbolos). */
export function slugBase(firstName: string, lastName: string): string {
  const base = `${firstName} ${lastName}`
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "jugador";
}
