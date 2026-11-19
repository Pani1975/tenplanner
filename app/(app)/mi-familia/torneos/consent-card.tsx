"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Check, Loader2, ShieldCheck, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

/**
 * Aviso para la familia: su jugador está inscrito y falta su
 * consentimiento. Puede darlo o decir que no participa.
 */
export function ConsentCard({
  entryId,
  side,
  player,
  tournamentName,
  organizer,
}: {
  entryId: string;
  side: "player" | "partner";
  player: string;
  tournamentName: string;
  organizer: string | null;
}) {
  const t = useTranslations("tournaments.familyConsent");
  const te = useTranslations("tournaments.errors");
  const router = useRouter();
  const [busy, setBusy] = useState<"consent" | "decline" | null>(null);
  const [confirmDecline, setConfirmDecline] = useState(false);
  const [imageConsent, setImageConsent] = useState(false);

  async function send(action: "consent" | "decline") {
    setBusy(action);
    const res = await fetch(`/api/family/tournaments/entries/${entryId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        side,
        action,
        imageConsent: action === "consent" && imageConsent,
      }),
    });
    setBusy(null);
    if (!res.ok) {
      let code = "generic";
      try {
        code = ((await res.json()) as { error?: string }).error ?? "generic";
      } catch {}
      toast.error(te.has(code) ? te(code) : te("generic"));
      return;
    }
    toast.success(action === "consent" ? t("given") : t("declined"));
    router.refresh();
  }

  return (
    <section className="tp-card space-y-3 border-amber-500 p-5">
      <p className="flex items-center gap-2 text-xs font-bold uppercase text-amber-700 dark:text-amber-400">
        <ShieldCheck className="size-4" />
        {t("kicker")}
      </p>
      <p className="tp-title text-xl">{t("title", { player })}</p>
      <p className="text-sm">
        {t("text", {
          player,
          tournament: tournamentName,
          organizer: organizer ?? t("theOrganizer"),
        })}
      </p>
      <label className="flex items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={imageConsent}
          onChange={(e) => setImageConsent(e.target.checked)}
          className="mt-0.5 size-5 shrink-0 accent-[#1a6db5]"
        />
        <span>{t("imageConsent", { player })}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => send("consent")}
          disabled={busy !== null}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1a6db5] px-5 text-sm font-bold text-white disabled:opacity-50"
        >
          {busy === "consent" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Check className="size-4" />
          )}
          {t("consent")}
        </button>
        <button
          type="button"
          onClick={() => setConfirmDecline(true)}
          disabled={busy !== null}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground/5 px-5 text-sm font-semibold disabled:opacity-50"
        >
          {busy === "decline" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <X className="size-4" />
          )}
          {t("decline")}
        </button>
      </div>
      <ConfirmDialog
        open={confirmDecline}
        onOpenChange={setConfirmDecline}
        title={t("declineTitle", { player })}
        description={t("declineText")}
        confirmLabel={t("decline")}
        destructive
        onConfirm={() => {
          setConfirmDecline(false);
          send("decline");
        }}
      />
    </section>
  );
}
