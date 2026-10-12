"use client";

import { useState } from "react";
import { Check, Share2 } from "lucide-react";

interface ShareButtonProps {
  title: string;
  text?: string;
  /** Ruta a compartir; por defecto, la página actual. */
  path?: string;
  className?: string;
  iconOnly?: boolean;
}

export function ShareButton({
  title,
  text,
  path,
  className,
  iconOnly = false,
}: ShareButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleShare() {
    const url = path
      ? new URL(path, window.location.origin).toString()
      : window.location.href;

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copia el enlace:", url);
    }
  }

  const label = copied ? "Enlace copiado" : "Compartir";

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={label}
      title={label}
      className={className}
    >
      {copied ? (
        <Check className="size-4" strokeWidth={1.8} />
      ) : (
        <Share2 className="size-4" strokeWidth={1.6} />
      )}
      {!iconOnly && label}
    </button>
  );
}
