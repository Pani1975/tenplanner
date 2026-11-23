"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** Enlace público con botón de copiar. */
export function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Sin permiso del portapapeles: el enlace sigue visible para copiarlo.
    }
  }
  return (
    <div className="flex items-center gap-2">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 truncate rounded-full border border-[#050505]/10 bg-background px-4 py-2.5 text-sm font-semibold text-brand-ink hover:underline dark:border-white/10"
      >
        {url.replace(/^https?:\/\//, "")}
      </a>
      <button
        type="button"
        onClick={copy}
        className="inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-[#050505]/15 px-4 text-sm font-bold hover:border-brand/50 dark:border-white/15"
      >
        {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        {copied ? "Copiado" : "Copiar"}
      </button>
    </div>
  );
}
