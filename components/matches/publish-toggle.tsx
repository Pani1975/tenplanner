"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Publicar o retirar un partido del palmarés público. */
export function PublishToggle({
  matchId,
  published,
}: {
  matchId: string;
  published: boolean;
}) {
  const router = useRouter();
  const [value, setValue] = useState(published);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function toggle() {
    const next = !value;
    setBusy(true);
    setError(false);
    const res = await fetch(`/api/matches/${matchId}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publish: next }),
    }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setError(true);
      return;
    }
    setValue(next);
    router.refresh();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      aria-label={value ? "Retirar del palmarés" : "Publicar en el palmarés"}
      title={
        error
          ? "No se ha podido cambiar"
          : value
            ? "Publicado en tu palmarés"
            : "No publicado"
      }
      onClick={toggle}
      disabled={busy}
      className={cn(
        "mr-3 inline-flex size-11 shrink-0 items-center justify-center rounded-full border transition",
        error
          ? "border-destructive text-destructive"
          : value
            ? "border-brand bg-brand text-brand-foreground"
            : "border-[#050505]/15 text-foreground/45 hover:border-brand/50 dark:border-white/15"
      )}
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <Globe className="size-4" />}
    </button>
  );
}
