"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, X } from "lucide-react";
import { useTranslations } from "next-intl";

interface Props {
  templateId: string;
}

export function PublishTemplateActions({ templateId }: Props) {
  const tx = useTranslations("ui.s_sessiontemplates_publishtemplateactions");
  const router = useRouter();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      await fetch(`/api/session-templates/${templateId}`, { method: "DELETE" });
      router.push("/sessions/templates");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/8 border border-brand/20 px-2.5 py-1 text-[11px] font-sans text-brand">
        {tx("tuPlantilla")}
      </span>

      {confirmDelete ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <span className="text-[12px] text-foreground/60">
            {tx("eliminarPlantilla")}
          </span>
          <button
            onClick={handleDelete}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-500 px-3 py-1.5 text-[12px] font-medium hover:bg-red-500/20 disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
            {tx("confirmar")}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            className="text-foreground/40 hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/15 px-3 py-1.5 text-[12px] font-medium text-foreground/60 hover:border-red-500/30 hover:text-red-500 transition-colors"
        >
          <Trash2 className="size-3.5" />{" "}{tx("despublicar")}
        </button>
      )}
    </div>
  );
}
