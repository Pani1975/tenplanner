"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { SPORT_OPTIONS, type Sport } from "@/lib/sport-constants";
import { useTranslations } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";

export function SportSwitcher({
  activeSport: initialActiveSport,
}: {
  activeSport: Sport;
}) {
  const term = useTerm();
  const tx = useTranslations("ui.s_app_sportswitcher");
  const router = useRouter();
  const [activeSport, setActiveSportState] = useState<Sport>(
    initialActiveSport
  );
  const [saving, setSaving] = useState<Sport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function selectSport(sport: Sport) {
    if (sport === activeSport) return;
    setSaving(sport);
    setError(null);
    const res = await fetch("/api/account/sport", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sport }),
    });
    if (res.ok) {
      setActiveSportState(sport);
      router.refresh();
    } else {
      setError(tx("noSePudoCambiar"));
    }
    setSaving(null);
  }

  return (
    <div className="tp-panel space-y-3 p-5 sm:p-6">
      <div>
        <h2 className="text-sm font-black uppercase text-foreground">
          {tx("deporte")}
        </h2>
        <p className="mt-1 text-xs text-foreground/55 leading-relaxed">
          {tx("eligeConQueDeporte")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {SPORT_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => selectSport(option.id)}
            disabled={saving !== null}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60",
              activeSport === option.id
                ? "border-brand bg-brand/10 text-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {saving === option.id && (
              <Loader2 className="size-4 animate-spin" />
            )}
            {term(option.label)}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
