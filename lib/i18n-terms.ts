import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";

/**
 * Términos sueltos (niveles, categorías, tipos de bloque…) que viven en
 * constantes del código en español. Se traducen al pintarlos:
 *   const term = useTerm();   …   {term(opt.label)}
 * La clave sale del propio texto en español (sin tildes, en minúsculas) y
 * los textos están en messages/*.json, bloque "terms". Si no hay traducción,
 * se muestra el texto tal cual.
 */
export function termKey(es: string): string {
  return es
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type Translator = {
  (key: string): string;
  has: (key: string) => boolean;
};

function translate(t: Translator, es: string): string {
  // Valores vacios o que no son texto se devuelven tal cual (nunca rompen la pagina).
  if (typeof es !== "string" || !es) return es;
  const key = termKey(es);
  return key && t.has(key) ? t(key) : es;
}

/** En componentes (cliente o servidor síncronos). */
export function useTerm(): (es: string) => string {
  const t = useTranslations("terms");
  return (es) => translate(t as unknown as Translator, es);
}

/** En componentes de servidor asíncronos. */
export async function getTerm(): Promise<(es: string) => string> {
  const t = await getTranslations("terms");
  return (es) => translate(t as unknown as Translator, es);
}
