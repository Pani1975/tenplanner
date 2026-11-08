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

export const LANDING_SCREENS: LandingScreen[] = [
  {
    src: "/landing/app/ejercicios-lista.webp",
    alt: "Biblioteca de ejercicios de tenis con duración, nivel por color de pelota y etiquetas",
    label: "Biblioteca de ejercicios",
  },
  {
    src: "/landing/app/ejercicio-animacion.webp",
    alt: "Ficha de un ejercicio con su animación en pista",
    label: "Cada ejercicio, animado en pista",
  },
  {
    src: "/landing/app/ejercicios-filtros.webp",
    alt: "Filtros de ejercicios por nivel, aspecto, fase y situación de juego",
    label: "Filtra por nivel y objetivo",
  },
  {
    src: "/landing/app/clase-detalle.webp",
    alt: "Ficha de una clase de competición de 90 minutos",
    label: "Clases listas para usar",
  },
  {
    src: "/landing/app/calendario.webp",
    alt: "Calendario de sesiones del club",
    label: "Tu calendario de sesiones",
  },
  {
    src: "/landing/app/estadisticas.webp",
    alt: "Estadísticas de entrenamiento: tiempo jugado, ejercicio más hecho y golpe más trabajado",
    label: "Seguimiento del trabajo hecho",
  },
];
