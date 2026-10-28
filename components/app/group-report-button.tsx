"use client";

import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function GroupReportButton({
  groupId,
  tone = "light",
}: {
  groupId: string;
  tone?: "light" | "hero";
}) {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setDownloading(true);
    setError(null);
    try {
      const res = await fetch(`/api/groups/${groupId}/report/pdf`);
      if (!res.ok) throw new Error("No se pudo generar el informe");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `informe-grupo.pdf`;
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      if (match) a.download = match[1];
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={download}
        disabled={downloading}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold transition-colors disabled:opacity-60",
          tone === "hero"
            ? "border-white/12 bg-white/8 text-white hover:bg-white/12"
            : "border-foreground/20 text-foreground hover:border-foreground/40"
        )}
      >
        {downloading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <FileDown className="size-4" />
        )}
        Informe PDF
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
