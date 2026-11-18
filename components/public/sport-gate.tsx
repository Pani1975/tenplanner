"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { SPORT_OPTIONS, type Sport } from "@/lib/sport-constants";
import { useTranslations } from "next-intl";
import { useTerm } from "@/lib/i18n-terms";

export function SportGate({
  title = "¿Qué deporte entrenas?",
  description = "Elige un deporte para ver su biblioteca pública de ejercicios y clases.",
}: {
  title?: string;
  description?: string;
}) {
  const term = useTerm();
  const tx = useTranslations("ui.s_public_sportgate");
  const router = useRouter();
  const [loading, setLoading] = useState<Sport | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(sport: Sport) {
    setLoading(sport);
    setError(null);
    try {
      const res = await fetch("/api/public/sport", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sport }),
      });
      if (!res.ok) {
        setError(tx("noSePudoGuardar"));
        return;
      }
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden bg-[#F4F4F1] px-4 py-12 text-center text-[#050505] dark:bg-[#050505] dark:text-[#F4F4F1]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-[radial-gradient(circle_at_50%_0%,rgba(214,255,56,0.24),transparent_38%)]" />
      <div className="relative w-full max-w-lg overflow-hidden rounded-lg bg-[#050505] text-white shadow-[0_24px_80px_rgba(5,5,5,0.18)]">
        <div className="flex flex-col items-center gap-6 p-6 sm:p-8">
          <div>
            <p className="font-sans text-[10px] uppercase tracking-[0.24em] text-[#D6FF38]">
              {tx("bibliotecaPublica")}
            </p>
            <h1 className="mt-3 font-heading text-3xl font-semibold leading-tight text-white">
              {term(title)}
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-white/62">
              {term(description)}
            </p>
          </div>

          <div className="grid w-full grid-cols-2 gap-3">
            {SPORT_OPTIONS.map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => choose(option.id)}
                disabled={loading !== null}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/18 px-4 text-[14px] font-black text-white transition hover:border-[#D6FF38] hover:bg-[#D6FF38] hover:text-[#050505] disabled:opacity-50"
              >
                {loading === option.id && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                {term(option.label)}
              </button>
            ))}
          </div>

          {error && <p className="text-xs text-red-400">{error}</p>}
        </div>
        <div className="h-2 bg-[#D6FF38]" />
      </div>
    </div>
  );
}
