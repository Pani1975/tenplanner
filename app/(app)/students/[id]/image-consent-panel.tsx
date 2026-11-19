"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Camera, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Value = "yes" | "no" | "unknown";

/**
 * Autorización de imagen del alumno: sí / no / sin datos, fecha y
 * referencia del documento firmado. Se guarda en la persona y vale para
 * todo (fotos de torneos, redes…).
 */
export function ImageConsentPanel({
  studentId,
  initial,
}: {
  studentId: string;
  initial: { consent: boolean | null; on: string | null; ref: string | null };
}) {
  const t = useTranslations("tournaments.imageConsent");
  const router = useRouter();
  const [value, setValue] = useState<Value>(
    initial.consent === true
      ? "yes"
      : initial.consent === false
        ? "no"
        : "unknown"
  );
  const [on, setOn] = useState(initial.on ?? "");
  const [ref, setRef] = useState(initial.ref ?? "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const res = await fetch(`/api/students/${studentId}/image-consent`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        consent: value === "yes" ? true : value === "no" ? false : null,
        on: value === "unknown" ? null : on || null,
        ref: value === "unknown" ? null : ref.trim() || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      toast.error(t("error"));
      return;
    }
    toast.success(t("saved"));
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-2 text-sm text-foreground/70">
        <Camera className="size-4" />
        {t("help")}
      </p>
      <div
        className="grid grid-cols-3 gap-1 rounded-full bg-foreground/5 p-1"
        role="group"
        aria-label={t("title")}
      >
        {(["yes", "no", "unknown"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={value === v}
            onClick={() => setValue(v)}
            className={cn(
              "min-h-11 rounded-full px-2 text-sm font-bold",
              value === v
                ? v === "yes"
                  ? "bg-emerald-600 text-white"
                  : v === "no"
                    ? "bg-red-600 text-white"
                    : "bg-foreground text-background"
                : "text-foreground/70"
            )}
          >
            {t(`value.${v}`)}
          </button>
        ))}
      </div>
      {value !== "unknown" && (
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase text-foreground/60">
              {t("date")}
            </span>
            <input
              type="date"
              value={on}
              onChange={(e) => setOn(e.target.value)}
              className="tp-field h-11 w-full px-3 text-base"
            />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold uppercase text-foreground/60">
              {t("ref")}
            </span>
            <input
              value={ref}
              onChange={(e) => setRef(e.target.value)}
              maxLength={200}
              placeholder={t("refPlaceholder")}
              className="tp-field h-11 w-full px-4 text-base"
            />
          </label>
        </div>
      )}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-foreground px-5 text-sm font-bold text-background disabled:opacity-50"
        >
          {saving && <Loader2 className="size-4 animate-spin" />}
          {t("save")}
        </button>
      </div>
    </div>
  );
}
