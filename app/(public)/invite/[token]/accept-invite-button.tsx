"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export function AcceptInviteButton({
  token,
  clubName,
}: {
  token: string;
  clubName: string;
}) {
  const tx = useTranslations("ui.s_token_acceptinvitebutton");
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/clubs/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? tx("noSePudoAceptar"));
        return;
      }
      router.push("/club");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={accept}
        disabled={submitting}
        className="h-11 w-full rounded-full font-black"
      >
        {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
        {tx("aceptarInvitacionDe")}{" "}{clubName}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
