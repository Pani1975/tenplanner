"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Calendar, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  templateId: string;
}

export function AdoptTemplateButton({ templateId }: Props) {
  const tx = useTranslations("ui.s_sessiontemplates_adopttemplatebutton");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAdopt() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/session-templates/${templateId}/adopt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scheduledAt ? { scheduledAt } : {}),
      });
      const json = (await res.json()) as {
        data?: { sessionId: string };
        error?: string;
      };
      if (!res.ok) {
        setError(json.error ?? tx("errorAlAdoptarLa"));
        return;
      }
      router.push(`/sessions/${json.data!.sessionId}`);
    } catch {
      setError(tx("errorDeConexion"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-brand-foreground transition-colors hover:bg-brand/90 sm:w-auto"
      >
        <Download className="size-4" />{" "}{tx("adoptarPlantilla")}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="relative w-full max-w-sm rounded-2xl border border-foreground/15 bg-background p-6 space-y-5 shadow-xl">
            <button
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 text-foreground/40 hover:text-foreground transition-colors"
            >
              <X className="size-4" />
            </button>

            <div className="space-y-1">
              <p className="font-sans text-[9px] uppercase tracking-[0.22em] text-foreground/40">
                {tx("adoptarPlantilla")}
              </p>
              <h2 className="font-heading text-xl text-foreground">
                {tx("cuandoLaUsas")}
              </h2>
              <p className="text-[13px] text-foreground/55">
                {tx("eligeUnaFechaPara")}
              </p>
            </div>

            <div className="space-y-2">
              <label className="font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/50 flex items-center gap-1.5">
                <Calendar className="size-3" />{" "}{tx("fechaYHoraOpcional")}
              </label>
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="w-full rounded-lg border border-foreground/15 bg-foreground/[0.02] px-3 py-2 text-[13px] text-foreground focus:outline-none focus:border-brand/50"
              />
            </div>

            {error && <p className="text-[12px] text-red-500">{error}</p>}

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 rounded-lg border border-foreground/15 px-4 py-2 text-[13px] font-medium text-foreground/70 hover:border-foreground/30 transition-colors"
              >
                {tx("cancelar")}
              </button>
              <button
                onClick={handleAdopt}
                disabled={loading}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand text-brand-foreground px-4 py-2 text-[13px] font-semibold hover:bg-brand/90 disabled:opacity-60 transition-colors"
              >
                {loading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                {tx("adoptar")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
