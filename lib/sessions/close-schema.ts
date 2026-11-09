import { z } from "zod";
import { PLAN_CHANGE_REASON_IDS } from "./plan-change";

/**
 * Datos del cierre de una sesión (todos opcionales para no romper llamadas
 * antiguas): si se dio según lo planificado, motivo y valoración final.
 */
export const sessionCloseFields = {
  planFollowed: z.boolean().nullable().optional(),
  planChangeReason: z.enum(PLAN_CHANGE_REASON_IDS).nullable().optional(),
  sessionRating: z.number().int().min(1).max(5).nullable().optional(),
};

export type SessionCloseInput = {
  planFollowed?: boolean | null;
  planChangeReason?: string | null;
  sessionRating?: number | null;
};

/** Columnas de `sessions` a actualizar con lo que venga en la petición. */
export function sessionCloseValues(input: SessionCloseInput) {
  const values: {
    planFollowed?: boolean | null;
    planChangeReason?: string | null;
    sessionRating?: number | null;
  } = {};
  if (input.planFollowed !== undefined) {
    values.planFollowed = input.planFollowed;
    // Si se dio según lo planificado no hay motivo de cambio.
    if (input.planFollowed === true) values.planChangeReason = null;
  }
  if (input.planChangeReason !== undefined && input.planFollowed !== true) {
    values.planChangeReason = input.planChangeReason;
  }
  if (input.sessionRating !== undefined) {
    values.sessionRating = input.sessionRating;
  }
  return values;
}
