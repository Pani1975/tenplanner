"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SPORT_LABELS, type Sport } from "@/lib/sport-constants";

export interface PendingClubInvite {
  id: string;
  token: string;
  sport: Sport;
  clubId: string;
  clubName: string;
}

/**
 * Aviso dentro de la app para un monitor con invitaciones de club
 * pendientes a su email: puede aceptarlas o rechazarlas sin el enlace.
 */
export function PendingClubInvites({
  invites,
}: {
  invites: PendingClubInvite[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Record<string, "accepted" | "declined">>({});
  const [error, setError] = useState<string | null>(null);

  const visible = invites.filter((i) => !done[i.id]);
  const accepted = invites.filter((i) => done[i.id] === "accepted");
  if (visible.length === 0 && accepted.length === 0) return null;

  async function respond(
    invite: PendingClubInvite,
    action: "accept" | "decline"
  ) {
    setBusy(`${action}:${invite.id}`);
    setError(null);
    try {
      const res = await fetch(`/api/clubs/invites/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invite.token }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(
          typeof body?.error === "string"
            ? body.error
            : "No se pudo responder a la invitación."
        );
        return;
      }
      setDone((d) => ({
        ...d,
        [invite.id]: action === "accept" ? "accepted" : "declined",
      }));
      // Recarga el menú: aparece el club en el selector de modo
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-2 px-4 pt-4 sm:px-6">
      {visible.map((invite) => (
        <div
          key={invite.id}
          className="rounded-2xl border border-brand/40 bg-brand/10 p-4"
        >
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand text-brand-foreground">
              <Building2 className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-foreground">
                {invite.clubName} te invita a unirte como monitor de{" "}
                {SPORT_LABELS[invite.sport]}
              </p>
              <p className="mt-1 text-xs leading-5 text-foreground/65">
                Si aceptas, podrás trabajar en modo particular o en el espacio
                de {invite.clubName}, cambiando desde el selector de modo. El
                club tendrá acceso compartido a lo que crees en su espacio.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  disabled={!!busy}
                  onClick={() => respond(invite, "accept")}
                >
                  {busy === `accept:${invite.id}` ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Check className="size-3.5" />
                  )}
                  Aceptar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={!!busy}
                  onClick={() => respond(invite, "decline")}
                >
                  {busy === `decline:${invite.id}` ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <X className="size-3.5" />
                  )}
                  Rechazar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ))}
      {accepted.map((invite) => (
        <p
          key={invite.id}
          role="status"
          className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-foreground"
        >
          Ya formas parte de {invite.clubName}. Elige &quot;{invite.clubName}
          &quot; en el selector de modo para trabajar en su espacio.
        </p>
      ))}
      {error && (
        <p role="alert" className="text-sm font-semibold text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
