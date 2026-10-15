/**
 * Nombres de los apartados propios según el espacio en el que se trabaja
 * (modo de trabajo, ver lib/clubs.ts): en modo particular son "Mis…"; en
 * modo club, el contenido es del club y se nombra así ("Clases club"…).
 *
 * Sin dependencias de servidor: se usa también en componentes cliente.
 */
export function spaceLabels(inClub: boolean) {
  return inClub
    ? {
        classes: "Clases club",
        exercises: "Ejercicios club",
        favorites: "Favoritos club",
        lists: "Listas club",
      }
    : {
        classes: "Mis clases",
        exercises: "Mis ejercicios",
        favorites: "Favoritos",
        lists: "Mis listas",
      };
}

export type SpaceLabels = ReturnType<typeof spaceLabels>;
