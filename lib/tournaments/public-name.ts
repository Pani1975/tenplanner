// Nombre que se muestra en la página pública del torneo. Nunca correo ni
// teléfono: solo nombre e inicial del primer apellido ("Lucía G.").
// Menores: solo iniciales ("L. G.") salvo que se decida otra cosa
// (pendiente de confirmar por David; ver docs/handoff.md).

export type PublicPerson = {
  firstName: string;
  lastName?: string | null;
  isMinor?: boolean;
};

const initial = (s: string | null | undefined) => {
  const w = (s ?? "").trim().split(/\s+/)[0] ?? "";
  // Primera letra (con tildes y ñ), en mayúscula.
  const ch = Array.from(w)[0];
  return ch ? `${ch.toLocaleUpperCase("es")}.` : "";
};

const firstWord = (s: string) => (s.trim().split(/\s+/)[0] ?? "").trim();

export function publicName(
  p: PublicPerson,
  opts: { minorsInitialsOnly?: boolean } = {}
): string {
  const minorsInitialsOnly = opts.minorsInitialsOnly ?? true;
  const last = initial(p.lastName);
  if (p.isMinor && minorsInitialsOnly) {
    return [initial(p.firstName), last].filter(Boolean).join(" ");
  }
  return [firstWord(p.firstName), last].filter(Boolean).join(" ");
}

/** Dobles: "Lucía G. / Marta R.". */
export function publicTeamName(
  player: PublicPerson,
  partner: PublicPerson | null,
  opts?: { minorsInitialsOnly?: boolean }
): string {
  const a = publicName(player, opts);
  if (!partner || !partner.firstName.trim()) return a;
  return `${a} / ${publicName(partner, opts)}`;
}
