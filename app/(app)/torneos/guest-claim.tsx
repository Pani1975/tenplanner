"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";

/**
 * Con sesión iniciada en el navegador donde se crearon torneos de prueba:
 * pasarlos a la cuenta (dejan de caducar).
 */
export function GuestClaimCard({ count }: { count: number }) {
  const t = useTranslations("tournaments.guest");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function claim() {
    setBusy(true);
    const res = await fetch("/api/tournaments/claim", { method: "POST" });
    setBusy(false);
    if (!res.ok) {
      toast.error(t("importError"));
      return;
    }
    const { data } = (await res.json()) as { data: { claimed: number } };
    toast.success(t("importDone", { count: data.claimed }));
    router.refresh();
  }
  return (
    <div className="tp-card-soft flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold">{t("importTitle", { count })}</p>
        <p className="text-sm text-foreground/70">{t("claimText")}</p>
      </div>
      <button
        type="button"
        onClick={claim}
        disabled={busy}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#d6f04a] px-5 text-sm font-bold text-black disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Upload className="size-4" />
        )}
        {t("importButton")}
      </button>
    </div>
  );
}
