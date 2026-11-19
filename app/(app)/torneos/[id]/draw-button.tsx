"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { LayoutGrid, Loader2 } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { cn } from "@/lib/utils";
import { useApiError } from "../use-api-error";

/**
 * Genera el cuadro (o lo rehace si aún no hay resultados). Si hay
 * inscripciones sin consentimiento, pregunta antes de dejarlas fuera.
 */
export function DrawButton({
  tournamentId,
  redraw,
  variant = "primary",
}: {
  tournamentId: string;
  redraw: boolean;
  variant?: "primary" | "secondary";
}) {
  const t = useTranslations("tournaments.draw");
  const apiError = useApiError();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<number | null>(null);
  const [confirmRedraw, setConfirmRedraw] = useState(false);

  async function run(excludePending: boolean) {
    setBusy(true);
    const res = await fetch(`/api/tournaments/${tournamentId}/draw`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excludePending }),
    });
    setBusy(false);
    if (res.status === 409) {
      const body = (await res
        .clone()
        .json()
        .catch(() => null)) as {
        error?: string;
        detail?: { count?: number };
      } | null;
      if (body?.error === "pending_consent") {
        setPending(body.detail?.count ?? 0);
        return;
      }
    }
    if (!res.ok) {
      toast.error(await apiError(res));
      return;
    }
    toast.success(redraw ? t("redrawn") : t("generated"));
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => (redraw ? setConfirmRedraw(true) : run(false))}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold disabled:opacity-50",
          variant === "primary"
            ? "bg-[#d6f04a] text-black"
            : "bg-white/15 text-white hover:bg-white/25"
        )}
      >
        {busy ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <LayoutGrid className="size-4" />
        )}
        {redraw ? t("redraw") : t("generate")}
      </button>
      <ConfirmDialog
        open={pending !== null}
        onOpenChange={(o) => !o && setPending(null)}
        title={t("pendingTitle")}
        description={t("pendingText", { count: pending ?? 0 })}
        confirmLabel={t("pendingConfirm")}
        onConfirm={() => {
          setPending(null);
          run(true);
        }}
      />
      <ConfirmDialog
        open={confirmRedraw}
        onOpenChange={setConfirmRedraw}
        title={t("redrawTitle")}
        description={t("redrawText")}
        confirmLabel={t("redraw")}
        onConfirm={() => {
          setConfirmRedraw(false);
          run(false);
        }}
      />
    </>
  );
}
