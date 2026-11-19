// Slug de la página pública: nombre legible + sufijo aleatorio, para que
// no se pueda adivinar la URL de un torneo en borrador ni recorrerlas.

const ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

export function slugBase(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
}

// Aleatorio criptográfico por defecto (la URL no debe poder adivinarse).
const cryptoRandom = () =>
  globalThis.crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

export function randomSuffix(
  length = 6,
  random: () => number = cryptoRandom
): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(random() * ALPHABET.length)];
  }
  return out;
}

export function tournamentSlug(
  name: string,
  random: () => number = cryptoRandom
): string {
  const base = slugBase(name) || "torneo";
  return `${base}-${randomSuffix(6, random)}`;
}
