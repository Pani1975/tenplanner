// Qué hacer después de cambiar de modo de trabajo (selector de la barra
// lateral y de Perfil). El Modo administrador y el Modo gestión tienen su
// propio menú: al entrar se va a su página de inicio (Informes / Gestión) y
// al salir al Inicio, para no quedarse en una página que ese modo no tiene.
// Entre club y particular basta con refrescar la página actual.

import { MODE_ADMIN, MODE_MANAGEMENT } from "@/lib/work-mode-options";

export const ADMIN_MODE = MODE_ADMIN;

type Router = { push: (href: string) => void; refresh: () => void };

const MODE_HOME: Record<string, string> = {
  [MODE_ADMIN]: "/informes",
  [MODE_MANAGEMENT]: "/gestion",
};

export function goAfterModeChange(
  router: Router,
  previous: string | null,
  next: string | null
) {
  if (next && MODE_HOME[next]) router.push(MODE_HOME[next]);
  else if (previous && MODE_HOME[previous]) router.push("/dashboard");
  else router.refresh();
}
