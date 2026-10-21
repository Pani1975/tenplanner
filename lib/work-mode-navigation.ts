// Qué hacer después de cambiar de modo de trabajo (selector de la barra
// lateral y de Perfil). El Modo administrador tiene su propio menú (Informes,
// Ejercicios, Clases, Objetivos, Ayuda): al entrar se va a Informes y al salir
// al Inicio, para no quedarse en una página que ese modo no tiene. Entre club
// y particular basta con refrescar la página actual.

export const ADMIN_MODE = "tenplanner";

type Router = { push: (href: string) => void; refresh: () => void };

export function goAfterModeChange(
  router: Router,
  previous: string | null,
  next: string | null
) {
  if (next === ADMIN_MODE) router.push("/informes");
  else if (previous === ADMIN_MODE) router.push("/dashboard");
  else router.refresh();
}
