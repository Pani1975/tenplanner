"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";

export function CancelButton({ token }: { token: string }) {
  const t = useTranslations("tournaments.public");
  const te = useTranslations("tournaments.errors");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/public/torneos/cancelar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setBusy(false);
    if (!res.ok) {
      let code = "generic";
      try {
        code = ((await res.json()) as { error?: string }).error ?? "generic";
      } catch {}
      setError(te.has(code) ? te(code) : te("generic"));
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={cancel}
        disabled={busy}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-red-600 px-6 text-base font-bold text-white disabled:opacity-50"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {t("cancelConfirm")}
      </button>
      {error && (
        <p role="alert" className="text-sm font-semibold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
