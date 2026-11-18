"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { TriangleAlertIcon } from "lucide-react";
import { useTranslations } from "next-intl";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const tx = useTranslations("ui.s_app_error");
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl border border-destructive/20 bg-destructive/8">
        <TriangleAlertIcon className="size-6 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-semibold">{tx("algoHaFallado")}</h1>
        <p className="text-muted-foreground text-sm max-w-sm">
          {tx("haOcurridoUnError2")}
        </p>
        {error.digest && (
          <p className="text-muted-foreground/50 text-xs font-mono">
            {tx("referenciaV1", { v1: error.digest })}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          {tx("irAlInicio")}
        </Button>
        <Button onClick={reset}>{tx("intentarDeNuevo")}</Button>
      </div>
    </div>
  );
}
