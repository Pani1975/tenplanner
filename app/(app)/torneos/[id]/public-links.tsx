"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Copy, ExternalLink, Globe, Loader2, Lock, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiError } from "../use-api-error";

/**
 * Visibilidad del torneo (público o privado, se puede cambiar en cualquier
 * momento), enlace de la página pública y del circuito.
 */
export function PublicLinks({
  tournamentId,
  slug,
  isDraft,
  visibility,
  isClub,
  circuitSlug,
  baseUrl,
}: {
  tournamentId: string;
  slug: string;
  isDraft: boolean;
  visibility: "public" | "private";
  isClub: boolean;
  circuitSlug: string | null;
  baseUrl: string;
}) {
  const t = useTranslations("tournaments");
  const apiError = useApiError();
  const router = useRouter();
  const [busy, setBusy] = useState<"public" | "private" | null>(null);
  const url = `${baseUrl}/t/${slug}`;

  async function change(v: "public" | "private") {
    if (v === visibility) return;
    setBusy(v);
    const res = await fetch(`/api/tournaments/${tournamentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visibility: v }),
    });
    setBusy(null);
    if (!res.ok) {
      toast.error(await apiError(res));
      return;
    }
    toast.success(t(`visibility.changed.${v}`));
    router.refresh();
  }

  return (
    <section className="tp-card-soft space-y-3 p-4">
      <p className="text-xs font-bold uppercase text-foreground/60">
        {t("visibility.title")}
      </p>
      <div
        className="grid grid-cols-2 gap-1 rounded-full bg-background p-1"
        role="group"
        aria-label={t("visibility.title")}
      >
        {(["public", "private"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={visibility === v}
            disabled={busy !== null}
            onClick={() => change(v)}
            className={cn(
              "inline-flex min-h-11 items-center justify-center gap-2 rounded-full text-sm font-bold disabled:opacity-60",
              visibility === v
                ? "bg-[#d6f04a] text-black"
                : "text-foreground/70"
            )}
          >
            {busy === v ? (
              <Loader2 className="size-4 animate-spin" />
            ) : v === "public" ? (
              <Globe className="size-4" />
            ) : (
              <Lock className="size-4" />
            )}
            {t(`visibility.${v}`)}
          </button>
        ))}
      </div>
      <p className="text-sm text-foreground/75">
        {visibility === "public"
          ? t("visibility.publicHelp")
          : isClub
            ? t("visibility.privateHelpClub")
            : t("visibility.privateHelpCoach")}
      </p>

      {visibility === "public" &&
        (isDraft ? (
          <p className="text-sm text-foreground/75">
            {t("manager.publicAfterOpen")}
          </p>
        ) : (
          <>
            <p className="break-all text-sm font-semibold">{url}</p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(url);
                    toast.success(t("manager.copied"));
                  } catch {
                    toast.error(t("manager.copyFailed"));
                  }
                }}
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-4 text-sm font-bold text-black"
              >
                <Copy className="size-4" />
                {t("manager.copyLink")}
              </button>
              <a
                href={`/t/${slug}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-background px-4 text-sm font-bold"
              >
                <ExternalLink className="size-4" />
                {t("manager.openPublic")}
              </a>
              {circuitSlug && (
                <a
                  href={`/t/c/${circuitSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 rounded-full bg-background px-4 text-sm font-bold"
                >
                  <Trophy className="size-4" />
                  {t("manager.circuitStandings")}
                </a>
              )}
            </div>
          </>
        ))}
    </section>
  );
}
