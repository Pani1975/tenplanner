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

/** Título de un apartado con su dueño: "Ejercicios CT Tenerife". */
export function spaceTitle(section: string, mode: WorkMode): string {
  const owner = workModeOwner(mode);
  return owner ? `${section} ${owner}` : section;
}

/**
 * Título de un apartado con datos propios del monitor o del club (sesiones,
 * alumnos, grupos). En Modo Ten Planner esos datos siguen siendo del monitor,
 * no de la plataforma: "Alumnos de David".
 */
export function personalTitle(section: string, mode: WorkMode): string {
  if (mode.kind === "tenplanner")
    return spaceTitle(section, {
      kind: "particular",
      ownerName: mode.ownerName,
    });
  return spaceTitle(section, mode);
}

/** Etiqueta del modo: "Modo administrador", "Modo CT Tenerife" o "Modo particular". */
export function workModeKicker(mode: WorkMode): string {
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
  publicTab: boolean
): { kicker: string; title: string } {
  if (!mode || publicTab)
    return {
      kicker: "Biblioteca pública",
      title: `${section} ${TEN_PLANNER_NAME}`,
    };
  return { kicker: workModeKicker(mode), title: spaceTitle(section, mode) };
}
