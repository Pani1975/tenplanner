/**
 * Etiquetas de contactos de familia — sin dependencias de servidor, para
 * usarlas también en componentes cliente.
 */
export const GUARDIAN_RELATIONSHIPS = [
  "madre",
  "padre",
  "tutor_legal",
  "alumno",
] as const;
export type GuardianRelationship = (typeof GUARDIAN_RELATIONSHIPS)[number];

export const GUARDIAN_RELATIONSHIP_LABELS: Record<
  GuardianRelationship,
  string
> = {
  madre: "Madre",
  padre: "Padre",
  tutor_legal: "Tutor/a legal",
  alumno: "El propio alumno (mayor de edad)",
};

/** Versión del texto de consentimiento que acepta la familia. */
export const GUARDIAN_CONSENT_VERSION = "familia-v1";
