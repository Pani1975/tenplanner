"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AcceptFamilyInvite({
  token,
  clubName,
}: {
  token: string;
  clubName: string;
}) {
  const router = useRouter();
  const [consent, setConsent] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    if (!consent) {
      setError("Marca la casilla para continuar.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/guardian-invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, consent: true }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "No se pudo activar el acceso.");
        return;
      }
      router.push("/mensajes");
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <label className="flex items-start gap-2 text-sm leading-6 text-foreground/75">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          className="mt-1 size-4 shrink-0 accent-[var(--brand)]"
        />
        <span>
          Acepto que {clubName} me envíe mensajes a través de Ten Planner y que
          mis datos de contacto se usen para ello. Puedo pedir la baja al club
          en cualquier momento. Más información en la{" "}
          <Link href="/privacidad" className="font-semibold underline">
            política de privacidad
          </Link>
          .
        </span>
      </label>
      <Button
        type="button"
        onClick={accept}
        disabled={submitting}
        className="h-11 w-full rounded-full font-black"
      >
        {submitting && <Loader2 className="mr-2 size-4 animate-spin" />}
        Activar mi acceso
      </Button>
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
