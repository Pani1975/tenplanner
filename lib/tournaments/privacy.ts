// Datos de contacto de las inscripciones. Decisión de David (2026-11-19):
// en un torneo de club solo los ve el administrador del club (la cuenta
// dueña); el resto de monitores del club gestiona el torneo sin verlos. En
// modo particular los ve el monitor organizador. El token de cancelación
// no lo ve nadie: es solo para el enlace del correo.

const CONTACT_FIELDS = [
  "email",
  "phone",
  "guardianName",
  "guardianEmail",
  "guardianPhone",
  "partnerEmail",
  "partnerPhone",
  "partnerGuardianName",
  "partnerGuardianEmail",
  "partnerGuardianPhone",
  "consentByName",
] as const;

export function redactEntry<T extends object>(
  entry: T,
  canSeeContacts: boolean
): T & { contactsHidden: boolean } {
  const out: Record<string, unknown> = { ...entry, cancelToken: null };
  if (!("cancelToken" in entry)) delete out.cancelToken;
  if (!canSeeContacts) {
    for (const f of CONTACT_FIELDS) if (f in out) out[f] = null;
  }
  return { ...(out as T), contactsHidden: !canSeeContacts };
}

/** ¿Puede ver contactos? Particular: sí. Club: solo su administrador. */
export const canSeeContacts = (input: {
  clubId: string | null;
  ownedClubId: string | null;
}) => input.clubId === null || input.ownedClubId === input.clubId;
