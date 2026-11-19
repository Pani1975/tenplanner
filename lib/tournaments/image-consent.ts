// Autorización de imagen de una persona. Los alumnos la tienen en su ficha
// (vale para todo); los jugadores externos, en su inscripción. El sistema no
// bloquea publicar fotos: avisa de quién no tiene autorización.

export type ImageConsentStatus = "yes" | "no" | "unknown";

export function imageConsentStatus(p: {
  // Alumno: true / false / null (sin datos).
  studentConsent?: boolean | null;
  // Externo: fecha en que se autorizó, o null.
  entryConsentAt?: Date | string | null;
  isStudent: boolean;
}): ImageConsentStatus {
  if (p.isStudent) {
    if (p.studentConsent === true) return "yes";
    if (p.studentConsent === false) return "no";
    return "unknown";
  }
  return p.entryConsentAt ? "yes" : "unknown";
}

/** Personas sin autorización (no o sin datos), para el aviso antes de publicar. */
export function withoutImageConsent<T extends { image: ImageConsentStatus }>(
  people: T[]
): T[] {
  return people.filter((p) => p.image !== "yes");
}
