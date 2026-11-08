/**
 * Capturas reales de la app que se muestran en el móvil de la portada.
 *
 * Cada imagen va en /public/landing/app/ (vertical, idealmente 1080×2160 o
 * similar, sin la barra de estado del teléfono). Si la lista está vacía, la
 * portada sigue mostrando la maqueta dibujada.
 */
export interface LandingScreen {
  src: string;
  alt: string;
  /** Texto corto que aparece bajo el móvil mientras se ve esta pantalla. */
  label: string;
}

export const LANDING_SCREENS: LandingScreen[] = [];
