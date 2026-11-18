"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { setLocale } from "@/lib/actions/set-locale";
import { cn } from "@/lib/utils";

/** Selector ES / EN. Guarda el idioma en una cookie y recarga la página. */
export function LanguageSwitcher({
  className,
  compact = false,
}: {
  className?: string;
  compact?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function change(next: "es" | "en") {
    if (next === locale) return;
    startTransition(async () => {
      await setLocale(next);
      router.refresh();
    });
  }

  return (
    <div
      role="group"
      aria-label={t("language")}
      className={cn(
        "inline-flex items-center rounded-full border border-current/15 p-1 text-xs font-bold",
        compact ? "h-9" : "h-11",
        pending && "opacity-60",
        className
      )}
    >
      {(["es", "en"] as const).map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => change(code)}
          aria-pressed={locale === code}
          lang={code}
          title={code === "es" ? t("spanish") : t("english")}
          className={cn(
            "rounded-full px-2.5 uppercase transition",
            compact ? "min-h-7 min-w-7" : "min-h-9 min-w-9",
            locale === code
              ? "bg-[#050505] text-[#d6ff38]"
              : "opacity-70 hover:opacity-100"
          )}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
