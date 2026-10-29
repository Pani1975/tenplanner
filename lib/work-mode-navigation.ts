// Qué hacer después de cambiar de modo de trabajo (selector de la barra
// lateral y de Perfil). El Modo administrador y el Modo gestión tienen su
// propio menú: al entrar se va a su página de inicio (Informes / Gestión) y
// al salir al Inicio, para no quedarse en una página que ese modo no tiene.
// Entre club y particular basta con refrescar la página actual.
//
// El cambio de página es una navegación completa (no router.push): la barra
// lateral sale del layout del servidor, que Next conserva entre páginas, y con
// una navegación suave se quedaba con el menú del modo anterior.

import { MODE_ADMIN, MODE_MANAGEMENT } from "@/lib/work-mode-options";

export const ADMIN_MODE = MODE_ADMIN;

type Router = { refresh: () => void };

const MODE_HOME: Record<string, string> = {
  [MODE_ADMIN]: "/informes",
  [MODE_MANAGEMENT]: "/gestion",
};

export function goAfterModeChange(
  router: Router,
  previous: string | null,
  next: string | null
) {
  if (next && MODE_HOME[next]) window.location.assign(MODE_HOME[next]);
  else if (previous && MODE_HOME[previous])
    window.location.assign("/dashboard");
  else router.refresh();
}
