"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export function DeleteMatchButton({ matchId }: { matchId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    setError(null);
    const res = await fetch(`/api/matches/${matchId}`, { method: "DELETE" }).catch(
      () => null
    );
    if (!res?.ok) {
      setDeleting(false);
      setError("No se ha podido borrar el partido. Inténtalo de nuevo.");
      return;
    }
    router.push("/mis-partidos");
    router.refresh();
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 rounded-full text-destructive hover:text-destructive"
        disabled={deleting}
        onClick={() => setOpen(true)}
      >
        {deleting ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <Trash2 className="mr-2 size-4" />
        )}
        Borrar
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="¿Borrar este partido?"
        description="Se borrará de Mis partidos. No se puede deshacer."
        confirmLabel="Borrar partido"
        destructive
        onConfirm={remove}
      />
    </>
  );
}
