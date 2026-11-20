"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  ImagePlus,
  Loader2,
  QrCode,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useApiError } from "../use-api-error";
import { useTournamentApi } from "../tournament-api";

type Template = "classic" | "court" | "image";

/** Reduce la imagen del cartel (lado mayor 2400 px, JPG: el PDF no lee WebP). */
async function toJpeg(file: File) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, "image/jpeg", 0.85)
  );
  if (!blob) throw new Error("compress");
  return blob;
}

/** Miniatura orientativa de cada plantilla (el PDF es la referencia). */
function Thumb({
  template,
  image,
}: {
  template: Template;
  image: string | null;
}) {
  const qr = (
    <span className="flex items-center gap-1 rounded bg-white p-1">
      <QrCode className="size-4 text-black" />
      <span className="h-1 w-6 rounded bg-[#d6f04a]" />
    </span>
  );
  if (template === "court") {
    return (
      <div className="relative flex aspect-[1/1.414] flex-col justify-between overflow-hidden rounded-lg bg-[#050505] p-2">
        <div className="absolute inset-x-3 inset-y-2 border border-white/20" />
        <div className="absolute inset-x-3 top-1/2 border-t border-white/25" />
        <span className="absolute right-2 top-2 size-4 rounded-full bg-[#d6f04a]" />
        <span className="relative h-2 w-3/4 rounded bg-white" />
        <span className="relative h-5 rounded bg-[#1c1f14]" />
        <span className="relative">{qr}</span>
      </div>
    );
  }
  if (template === "image") {
    return (
      <div className="flex aspect-[1/1.414] flex-col overflow-hidden rounded-lg bg-white ring-1 ring-foreground/10">
        <div
          className="h-[42%] bg-foreground/15 bg-cover bg-center"
          style={image ? { backgroundImage: `url(${image})` } : undefined}
        >
          {!image && (
            <ImagePlus className="m-auto mt-3 size-5 text-foreground/40" />
          )}
        </div>
        <div className="bg-[#050505] p-1.5">
          <span className="block h-2 w-3/4 rounded bg-white" />
        </div>
        <div className="mt-auto p-1.5">{qr}</div>
      </div>
    );
  }
  return (
    <div className="flex aspect-[1/1.414] flex-col overflow-hidden rounded-lg bg-white ring-1 ring-foreground/10">
      <div className="relative overflow-hidden bg-[#050505] p-2 pb-4">
        <span className="absolute -right-3 -top-3 size-8 rounded-full bg-[#d6f04a]" />
        <span className="relative block h-2 w-3/4 rounded bg-white" />
      </div>
      <div className="space-y-1 p-2">
        <span className="block h-1 w-2/3 rounded bg-foreground/20" />
        <span className="block h-1 w-1/2 rounded bg-foreground/20" />
      </div>
      <div className="mt-auto p-1.5">{qr}</div>
    </div>
  );
}

/**
 * Cartel del torneo: plantilla (clásica, pista o con tu imagen), imagen
 * propia y descarga en PDF con QR al torneo.
 */
export function PosterPanel({
  tournamentId,
  template: initial,
  hasImage,
  isPrivate,
}: {
  tournamentId: string;
  template: Template;
  hasImage: boolean;
  isPrivate: boolean;
}) {
  const t = useTranslations("tournaments.poster");
  const apiError = useApiError();
  const api = useTournamentApi();
  const [template, setTemplate] = useState<Template>(initial);
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const base = `/api/tournaments/${tournamentId}`;

  useEffect(() => {
    if (!hasImage) return;
    let on = true;
    api
      .fetch(`${base}/poster-image`)
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => on && b?.data?.url && setImage(b.data.url));
    return () => {
      on = false;
    };
  }, [base, hasImage, api]);

  async function choose(v: Template) {
    if (v === template) return;
    if (v === "image" && !image) {
      input.current?.click();
      return;
    }
    setBusy(v);
    const res = await api.fetch(base, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ posterTemplate: v }),
    });
    setBusy(null);
    if (!res.ok) return toast.error(await apiError(res));
    setTemplate(v);
  }

  async function upload(file: File) {
    setBusy("upload");
    try {
      const blob = await toJpeg(file);
      const form = new FormData();
      form.append(
        "file",
        new File([blob], "cartel.jpg", { type: "image/jpeg" })
      );
      const res = await api.fetch(`${base}/poster-image`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        toast.error(await apiError(res));
        return;
      }
      setImage((await res.json()).data.url);
      setTemplate("image");
      toast.success(t("imageSaved"));
      api.refresh();
    } catch {
      toast.error(t("imageReadError"));
    } finally {
      setBusy(null);
    }
  }

  /** Modo prueba: el PDF llega en memoria y se descarga o se abre. */
  async function openPdf(inline: boolean) {
    setBusy("pdf");
    const tab = inline ? window.open("", "_blank") : null;
    try {
      const res = await api.fetch(`${base}/poster${inline ? "?inline=1" : ""}`);
      if (!res.ok) {
        tab?.close();
        toast.error(await apiError(res));
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      if (tab) tab.location.href = url;
      else {
        const a = document.createElement("a");
        a.href = url;
        a.download = "cartel-torneo.pdf";
        a.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setBusy(null);
    }
  }

  async function removeImage() {
    setBusy("remove");
    const res = await api.fetch(`${base}/poster-image`, { method: "DELETE" });
    setBusy(null);
    if (!res.ok) return toast.error(await apiError(res));
    setImage(null);
    if (template === "image") setTemplate("classic");
    api.refresh();
  }

  return (
    <section className="tp-card-soft space-y-4 p-4">
      <div>
        <p className="text-xs font-bold uppercase text-foreground/60">
          {t("title")}
        </p>
        <p className="text-sm text-foreground/75">
          {isPrivate ? t("helpPrivate") : t("help")}
        </p>
      </div>
      <div
        className="grid grid-cols-3 gap-2"
        role="radiogroup"
        aria-label={t("title")}
      >
        {(["classic", "court", "image"] as const).map((v) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={template === v}
            disabled={busy !== null}
            onClick={() => choose(v)}
            className={cn(
              "space-y-1.5 rounded-xl p-1.5 text-left disabled:opacity-60",
              template === v
                ? "bg-[var(--brand-muted)] ring-2 ring-[var(--brand-ink)]"
                : "bg-background"
            )}
          >
            <Thumb template={v} image={image} />
            <span className="flex min-h-6 items-center gap-1 px-0.5 text-xs font-bold">
              {busy === v && <Loader2 className="size-3 animate-spin" />}
              {t(`template.${v}`)}
            </span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy !== null}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-background px-4 text-sm font-bold disabled:opacity-60"
        >
          {busy === "upload" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ImagePlus className="size-4" />
          )}
          {image ? t("changeImage") : t("addImage")}
        </button>
        {image && (
          <button
            type="button"
            onClick={removeImage}
            disabled={busy !== null}
            aria-label={t("removeImage")}
            title={t("removeImage")}
            className="inline-flex size-11 items-center justify-center rounded-full bg-background text-red-600 disabled:opacity-60"
          >
            {busy === "remove" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
      </div>

      {api.guest ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => openPdf(false)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-5 text-sm font-bold text-black disabled:opacity-60"
          >
            {busy === "pdf" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Download className="size-4" />
            )}
            {t("download")}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => openPdf(true)}
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-background px-4 text-sm font-bold disabled:opacity-60"
          >
            <ExternalLink className="size-4" />
            {t("open")}
          </button>
        </div>
      ) : (
      <div className="flex flex-wrap gap-2">
        <a
          href={`${base}/poster`}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-5 text-sm font-bold text-black"
        >
          <Download className="size-4" />
          {t("download")}
        </a>
        <a
          href={`${base}/poster?inline=1`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-background px-4 text-sm font-bold"
        >
          <ExternalLink className="size-4" />
          {t("open")}
        </a>
      </div>
      )}
    </section>
  );
}
