"use client";

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, ExternalLink, Trophy } from "lucide-react";

/** Enlace de la página pública (para compartir) y del circuito. */
export function PublicLinks({
  slug,
  isPublic,
  circuitSlug,
  baseUrl,
}: {
  slug: string;
  isPublic: boolean;
  circuitSlug: string | null;
  baseUrl: string;
}) {
  const t = useTranslations("tournaments.manager");
  const url = `${baseUrl}/t/${slug}`;

  if (!isPublic) {
    return <p className="tp-card-soft p-4 text-sm">{t("publicAfterOpen")}</p>;
  }
  return (
    <section className="tp-card-soft space-y-3 p-4">
      <p className="text-xs font-bold uppercase text-foreground/60">
        {t("publicLink")}
      </p>
      <p className="break-all text-sm font-semibold">{url}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(url);
              toast.success(t("copied"));
            } catch {
              toast.error(t("copyFailed"));
            }
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1a6db5] px-4 text-sm font-bold text-white"
        >
          <Copy className="size-4" />
          {t("copyLink")}
        </button>
        <a
          href={`/t/${slug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-background px-4 text-sm font-bold"
        >
          <ExternalLink className="size-4" />
          {t("openPublic")}
        </a>
        {circuitSlug && (
          <a
            href={`/t/c/${circuitSlug}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-background px-4 text-sm font-bold"
          >
            <Trophy className="size-4" />
            {t("circuitStandings")}
          </a>
        )}
      </div>
    </section>
  );
}
