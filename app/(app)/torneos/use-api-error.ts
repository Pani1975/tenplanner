"use client";

import { useTranslations } from "next-intl";

/** Texto del error que devuelve la API de torneos ({ error: código }). */
export function useApiError() {
  const t = useTranslations("tournaments.errors");
  return async (res: Response) => {
    try {
      const body = (await res.json()) as { error?: string };
      if (body.error && t.has(body.error)) return t(body.error);
    } catch {
      // Respuesta sin JSON.
    }
    return t("generic");
  };
}
