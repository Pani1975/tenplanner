"use client";

import { useEffect, useState } from "react";
import { ArrowDown, X } from "lucide-react";

// Acepta enlaces de YouTube (watch, youtu.be, embed) y devuelve la URL de
// embed sin cookies, o null si no es un enlace válido.
function youtubeEmbedUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    const host = url.hostname.replace(/^www\./, "");
    let id: string | null = null;
    if (host === "youtu.be") id = url.pathname.slice(1);
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      id = url.searchParams.get("v") ?? url.pathname.split("/").pop() ?? null;
    }
    if (!id || !/^[\w-]{6,20}$/.test(id)) return null;
    return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`;
  } catch {
    return null;
  }
}

export function HeroVideoButton({
  label,
  videoUrl,
}: {
  label: string;
  videoUrl: string;
}) {
  const [open, setOpen] = useState(false);
  const embed = youtubeEmbedUrl(videoUrl);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const className =
    "inline-flex min-h-11 items-center gap-2 text-base font-semibold text-[#5f7000]";

  // Sin vídeo configurado, mantiene el comportamiento anterior (scroll).
  if (!embed) {
    return (
      <a href="#como-funciona" className={className}>
        {label} <ArrowDown className="size-4" />
      </a>
    );
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {label} <ArrowDown className="size-4" />
      </button>
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={label}
          className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative w-full max-w-4xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Cerrar vídeo"
              className="absolute -top-12 right-0 grid size-10 place-items-center rounded-full bg-white text-[#050505]"
            >
              <X className="size-5" />
            </button>
            <div className="aspect-video overflow-hidden rounded-2xl bg-black">
              <iframe
                src={embed}
                title={label}
                className="size-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
