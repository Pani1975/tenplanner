// Consentimiento para participar en un torneo. Decisión de David
// (2026-11-19): por ahora lo declara el monitor al añadir alumnos de la
// escuela ("coach_declared"); más adelante se pedirá al tutor por enlace
// ("guardian_link"), como en Mensajes. Quien se inscribe por el enlace
// público lo da en el formulario ("form").

export const TOURNAMENT_CONSENT_VERSION = "torneo-v1";

export type ConsentMethod = "form" | "coach_declared" | "guardian_link";

export type ConsentRecord = {
  consentAt: Date;
  consentVersion: string;
  consentMethod: ConsentMethod;
  consentByUserId: string | null;
  consentByName: string;
};

export type ConsentError = "missing_user" | "missing_name";

/**
 * Datos de consentimiento que se guardan en la inscripción. Siempre queda
 * quién lo da y cuándo; si lo declara el monitor, también su usuario.
 */
export function consentRecord(input: {
  method: ConsentMethod;
  byName: string | null | undefined;
  byUserId?: string | null;
  now?: Date;
}): { ok: true; record: ConsentRecord } | { ok: false; error: ConsentError } {
  const name = (input.byName ?? "").trim();
  if (!name) return { ok: false, error: "missing_name" };
  if (input.method === "coach_declared" && !input.byUserId) {
    return { ok: false, error: "missing_user" };
  }
  return {
    ok: true,
    record: {
      consentAt: input.now ?? new Date(),
      consentVersion: TOURNAMENT_CONSENT_VERSION,
      consentMethod: input.method,
      consentByUserId: input.byUserId ?? null,
      consentByName: name.slice(0, 120),
    },
  };
}

/**
 * Consentimiento dado por el propio jugador o su tutor (no solo declarado
 * por el monitor). Sirve para saber a quién habrá que pedir el enlace
 * cuando exista ese paso.
 */
export const isDirectConsent = (method: ConsentMethod | null | undefined) =>
  method === "form" || method === "guardian_link";

export type PartnerConsentFields = {
  partnerConsentAt: Date;
  partnerConsentMethod: ConsentMethod;
  partnerConsentByUserId: string | null;
  partnerConsentByName: string;
};

/** El mismo consentimiento, guardado para la pareja (dobles). */
export function asPartnerConsent(r: ConsentRecord): PartnerConsentFields {
  return {
    partnerConsentAt: r.consentAt,
    partnerConsentMethod: r.consentMethod,
    partnerConsentByUserId: r.consentByUserId,
    partnerConsentByName: r.consentByName,
  };
}

/**
 * ¿Tiene la inscripción todos los consentimientos? El del jugador y, en
 * dobles, también el de la pareja.
 */
export function isConsentComplete(e: {
  consentAt: Date | string | null;
  partnerFirstName?: string | null;
  partnerConsentAt?: Date | string | null;
}): boolean {
  if (!e.consentAt) return false;
  if (e.partnerFirstName && !e.partnerConsentAt) return false;
  return true;
}
