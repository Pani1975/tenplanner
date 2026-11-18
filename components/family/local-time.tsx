"use client";

import { useLocale } from "next-intl";

/**
 * Fecha/hora en la zona horaria del navegador (como el calendario del
 * monitor). El servidor no conoce la zona del usuario, así que el texto
 * del primer render puede diferir y se silencia el aviso de hidratación.
 */
export function LocalDateTime({
  iso,
  options,
}: {
  iso: string;
  options: Intl.DateTimeFormatOptions;
}) {
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {new Intl.DateTimeFormat(intlLocale, options).format(new Date(iso))}
    </time>
  );
}
