// Nombre que se muestra en la página pública del torneo. Nunca correo ni
// teléfono. Decisión de David (2026-11-19): nombre e iniciales de los
// apellidos para todos los jugadores, de la escuela o externos, también
// menores: "Lucía García López" → "Lucía G. L.".

export type PublicPerson = {
  firstName: string;
  lastName?: string | null;
};

// Partículas que no dan inicial: "Fernández de la Vega" → "F. V.".
const PARTICLES = new Set(["de", "del", "la", "las", "los", "y", "i", "da"]);

const cap = (w: string) => {
  const ch = Array.from(w)[0];
  return ch ? `${ch.toLocaleUpperCase("es")}.` : "";
};

export function surnameInitials(lastName: string | null | undefined): string {
  return (lastName ?? "")
    .trim()
    .split(/[\s-]+/)
    .filter((w) => w && !PARTICLES.has(w.toLocaleLowerCase("es")))
    .map(cap)
    .join(" ");
}

const clean = (s: string) => s.trim().replace(/\s+/g, " ");

export function publicName(p: PublicPerson): string {
  return [clean(p.firstName), surnameInitials(p.lastName)]
    .filter(Boolean)
    .join(" ");
}

/** Dobles: "Lucía G. L. / Marta R.". */
export function publicTeamName(
  player: PublicPerson,
  partner: PublicPerson | null
): string {
  const a = publicName(player);
  if (!partner || !partner.firstName.trim()) return a;
  return `${a} / ${publicName(partner)}`;
}
