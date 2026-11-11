// Medidas de la pista de la animación de clases (unidades del SVG) y paso de
// las coordenadas de los esquemas de ejercicio a esa pista.
import type { CourtKind, Pt } from "@/lib/exercise-diagrams/types";

export const W = 400;
export const H = 210;
export const COURT = { x: 40, y: 30, w: 320, h: 150 };
export const NET_X = COURT.x + COURT.w / 2;
export const MID_Y = COURT.y + COURT.h / 2;
/** Líneas laterales de individuales (el pasillo de dobles queda fuera). */
export const SINGLES_TOP = COURT.y + COURT.h * 0.125;
export const SINGLES_BOTTOM = COURT.y + COURT.h * 0.875;
/** Líneas de saque de cada campo. */
export const SERVICE_LEFT_X = COURT.x + COURT.w * 0.22;
export const SERVICE_RIGHT = COURT.x + COURT.w * 0.78;

/**
 * Pasa un punto del esquema (0-100) a la pista alargada de la animación.
 * La pista se ve de lado: la red es vertical en el centro y los fondos quedan
 * a izquierda y derecha. Todos los tipos de esquema se dibujan sobre esta
 * misma pista para que la animación tenga un único diseño:
 *  - "tenis" y "libre": la pista completa;
 *  - "mini": la pista completa a lo largo y entre las líneas de individuales;
 *  - "medio": el campo de la derecha (y = 0 es la red).
 */
export function courtPoint(court: CourtKind, p: Pt): { x: number; y: number } {
  const [px, py] = p;
  const across = (lo: number, hi: number) => lo + (px / 100) * (hi - lo);
  switch (court) {
    case "medio":
      return {
        x: NET_X + (py / 100) * (COURT.w / 2),
        y: across(COURT.y, COURT.y + COURT.h),
      };
    case "mini":
      return {
        x: COURT.x + (py / 100) * COURT.w,
        y: across(SINGLES_TOP, SINGLES_BOTTOM),
      };
    default:
      return {
        x: COURT.x + (py / 100) * COURT.w,
        y: across(COURT.y, COURT.y + COURT.h),
      };
  }
}
