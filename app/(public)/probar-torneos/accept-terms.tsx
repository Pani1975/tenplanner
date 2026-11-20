"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

/** Condiciones del modo prueba (correo, caducidad, datos de terceros). */
export function AcceptTerms({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const t = useTranslations("tournaments.guest");
  return (
    <label className="flex items-start gap-2 text-xs text-foreground/75">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 size-4 shrink-0"
      />
      <span>
        {t("accept")}{" "}
        <Link href="/terminos" className="underline" target="_blank">
          {t("terms")}
        </Link>{" "}
        ·{" "}
        <Link href="/privacidad" className="underline" target="_blank">
          {t("privacy")}
        </Link>
      </span>
    </label>
  );
}
