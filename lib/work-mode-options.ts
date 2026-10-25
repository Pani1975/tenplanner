// Qué modos de trabajo puede elegir cada cuenta (selector de la barra lateral
// y de Perfil). Sin dependencias de servidor: se usa en componentes cliente.
//
// - Cuenta de un club: Modo <club> (compartido con sus monitores) y Modo
//   gestión (solo esta cuenta: informes, calendario, alumnos, mensajes y
//   monitores). Sin Modo particular.
// - Administrador de la plataforma con club propio (p. ej. Paniagua): además
//   de lo de una cuenta de club, el Modo administrador (lo público).
// - Administrador sin club: Modo administrador, los clubes a los que
//   pertenece y Modo particular.
// - Monitor: Modo particular y el modo de cada club que le ha invitado.

export const MODE_PARTICULAR = "particular";
export const MODE_ADMIN = "tenplanner";
export const MODE_MANAGEMENT = "gestion";

export type WorkModeKind = "admin" | "management" | "club" | "particular";

export type WorkModeOption = {
  /** "tenplanner", "gestion", "particular" o el id del club. */
  key: string;
  kind: WorkModeKind;
  /** Nombre tras "Modo": "administrador", "CT Tenerife", "particular". */
  name: string;
};

export function workModeOptions({
  clubs,
  isAdmin,
  clubAccountClubId,
}: {
  clubs: { id: string; name: string }[];
  isAdmin: boolean;
  clubAccountClubId: string | null;
}): WorkModeOption[] {
  const clubOptions: WorkModeOption[] = clubs.map((club) => ({
    key: club.id,
    kind: "club",
    name: club.name,
  }));
  const particular: WorkModeOption = {
    key: MODE_PARTICULAR,
    kind: "particular",
    name: "particular",
  };

  if (clubAccountClubId) {
    const own = clubOptions.filter((o) => o.key === clubAccountClubId);
    return [
      ...(isAdmin
        ? [{ key: MODE_ADMIN, kind: "admin", name: "administrador" } as const]
        : []),
      ...own,
      { key: MODE_MANAGEMENT, kind: "management", name: "gestión" },
    ];
  }
  if (isAdmin)
    return [
      { key: MODE_ADMIN, kind: "admin", name: "administrador" },
      ...clubOptions,
      particular,
    ];
  return [...clubOptions, particular];
}

/** Clave del modo activo a partir del estado del servidor. */
export function activeWorkModeKey({
  tenPlannerMode,
  managementMode,
  activeClubId,
}: {
  tenPlannerMode: boolean;
  managementMode: boolean;
  activeClubId: string | null;
}): string {
  if (tenPlannerMode) return MODE_ADMIN;
  if (managementMode) return MODE_MANAGEMENT;
  return activeClubId ?? MODE_PARTICULAR;
}

/** Cuerpo de la petición PATCH /api/account/work-mode para una clave. */
export function workModeRequestBody(key: string) {
  if (key === MODE_ADMIN || key === MODE_MANAGEMENT) return { mode: key };
  return { clubId: key === MODE_PARTICULAR ? null : key };
}
