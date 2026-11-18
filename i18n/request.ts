import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { LOCALE_COOKIE, normalizeLocale } from "@/lib/locale";
import es from "../messages/es.json";

type Messages = Record<string, unknown>;

function isObject(value: unknown): value is Messages {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Completa `base` (español) con lo que haya en `over` (inglés). */
function merge(base: Messages, over: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(over)) {
    const current = out[key];
    out[key] =
      isObject(current) && isObject(value) ? merge(current, value) : value;
  }
  return out;
}

// Idioma por cookie (sin prefijo en la URL): el español sigue siendo el
// predeterminado y las rutas no cambian. Si a un texto en inglés le falta la
// traducción, se muestra el español en vez de la clave.
export default getRequestConfig(async () => {
  const store = await cookies();
  const locale = normalizeLocale(store.get(LOCALE_COOKIE)?.value);
  const messages =
    locale === "es"
      ? (es as Messages)
      : merge(
          es as Messages,
          (await import("../messages/en.json")).default as Messages
        );
  return { locale, messages };
}
);
