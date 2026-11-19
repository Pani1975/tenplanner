// Nombres del dueño de cada espacio para las cabeceras ("Ejercicios CT
// Tenerife", "Ejercicios de David", "Ejercicios Ten Planner"). Sin
// dependencias de servidor: se usa también en componentes cliente.

export type WorkMode =
  | { kind: "tenplanner"; ownerName: string }
  | {
      kind: "club";
      clubId: string;
      clubName: string;
      /** Modo gestión: el espacio privado del gestor del club. */
      management?: boolean;
    }
  | { kind: "particular"; ownerName: string };

export const TEN_PLANNER_NAME = "Ten Planner";

/** Nombre de pila (primera palabra) para "de David". */
function firstName(name: string) {
  return name.trim().split(/\s+/)[0] ?? "";
}

/** Quién es el dueño del espacio: "Ten Planner", el club o "de David". */
export function workModeOwner(mode: WorkMode): string {
  if (mode.kind === "tenplanner") return TEN_PLANNER_NAME;
  if (mode.kind === "club") return mode.clubName;
  const name = firstName(mode.ownerName);
  return name ? `de ${name}` : "";
}

const SECTION_EN: Record<string, string> = {
  Calendario: "Calendar",
  Clases: "Lessons",
  Ejercicios: "Drills",
  Grupos: "Groups",
  Objetivos: "Goals",
  Sesiones: "Sessions",
  Alumnos: "Students",
};

/** Título de un apartado con su dueño: "Ejercicios CT Tenerife". */
export function spaceTitle(
  section: string,
  mode: WorkMode,
  locale: string = "es"
): string {
  const owner = workModeOwner(mode);
  if (locale === "en") {
    const name = SECTION_EN[section] ?? section;
    // "de David" -> "David's Exercises"
    if (owner.startsWith("de ")) return `${owner.slice(3)}'s ${name}`;
    return owner ? `${name} ${owner}` : name;
  }
  return owner ? `${section} ${owner}` : section;
}

/**
 * Título de un apartado con datos propios del monitor o del club (sesiones,
 * alumnos, grupos). En Modo Ten Planner esos datos siguen siendo del monitor,
 * no de la plataforma: "Alumnos de David".
 */
export function personalTitle(
  section: string,
  mode: WorkMode,
  locale: string = "es"
): string {
  if (mode.kind === "tenplanner")
    return spaceTitle(
      section,
      { kind: "particular", ownerName: mode.ownerName },
      locale
    );
  return spaceTitle(section, mode, locale);
}

/** Etiqueta del modo: "Modo administrador", "Modo CT Tenerife" o "Modo particular". */
export function workModeKicker(mode: WorkMode, locale: string = "es"): string {
  if (locale === "en")
    return mode.kind === "tenplanner"
      ? "Administrator mode"
      : mode.kind === "club"
        ? mode.management
          ? "Management mode"
          : `${mode.clubName} mode`
        : "Individual mode";
  return mode.kind === "tenplanner"
    ? "Modo administrador"
    : mode.kind === "club"
      ? mode.management
        ? "Modo gestión"
        : `Modo ${mode.clubName}`
      : "Modo particular";
}

/**
 * Cabecera de una biblioteca (ejercicios, clases): la pestaña de la
 * Biblioteca pública o una visita sin sesión es "… Ten Planner"; el resto de
 * pestañas son del espacio del modo de trabajo ("… CT Tenerife").
 */
export function libraryHeading(
  section: string,
  mode: WorkMode | null,
  publicTab: boolean,
  locale: string = "es"
): { kicker: string; title: string } {
  if (!mode || publicTab)
    return {
      kicker: locale === "en" ? "Public library" : "Biblioteca pública",
      title: `${locale === "en" ? (SECTION_EN[section] ?? section) : section} ${TEN_PLANNER_NAME}`,
    };
  return {
    kicker: workModeKicker(mode, locale),
    title: spaceTitle(section, mode, locale),
  };
}
