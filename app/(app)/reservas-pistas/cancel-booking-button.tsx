"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";

/** Cancelar una reserva de cliente desde la ocupación de pistas. */
export function CancelBookingButton({
  id,
  name,
}: {
  id: string;
  name: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function cancel() {
    setBusy(true);
    const res = await fetch(`/api/court-bookings/${id}`, {
      method: "DELETE",
    }).catch(() => null);
    setBusy(false);
    setConfirming(false);
    if (res?.ok) router.refresh();
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        aria-label={`Cancelar la reserva de ${name}`}
        className="rounded-full p-0.5 text-foreground/50 hover:bg-black/10 hover:text-foreground"
      >
        <X className="size-3.5" />
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => void cancel()}
        disabled={busy}
        className="inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white"
      >
        {busy && <Loader2 className="size-3 animate-spin" />}
        Cancelar reserva
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-foreground/60"
      >
        No
      </button>
    </span>
  );
}
