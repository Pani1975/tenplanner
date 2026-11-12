// Vía por la que se crea una sesión (columna sessions.created_via), para
// medir qué porcentaje sale del motor "Monta la clase" frente al resto.

export const SESSION_CREATED_VIA = [
  "wizard",
  "quick",
  "from_class",
  "duplicate",
  "repeat",
  "dr_planner",
  "template",
  "engine",
] as const;

export type SessionCreatedVia = (typeof SESSION_CREATED_VIA)[number];
