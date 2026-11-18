"use client";

import { useState, useTransition } from "react";
import { Link2, Copy, CheckCheck, Loader2, RefreshCw } from "lucide-react";
import { generateProfileLink } from "./actions";
import { useTranslations } from "next-intl";

export function GenerateProfileLinkButton({
  studentId,
}: {
  studentId: string;
}) {
  const tx = useTranslations("ui.s_id_generateprofilelink");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function generate() {
    startTransition(async () => {
      const res = await generateProfileLink(studentId);
      if (res.ok) {
        const origin = window.location.origin;
        setLink(`${origin}/s/${res.token}`);
      }
    });
  }

  function copy() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  if (!link) {
    return (
      <button
        type="button"
        onClick={generate}
        disabled={isPending}
        className="inline-flex items-center gap-2 text-sm font-medium border border-border px-3 py-2 rounded-lg hover:bg-muted hover:text-foreground text-muted-foreground transition-colors disabled:opacity-60"
      >
        {isPending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <Link2 className="size-3.5" />
        )}
        <span>{tx("generarEnlace")}</span>
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 w-full">
      <div className="flex items-center gap-2 p-2.5 bg-muted/50 border border-border rounded-lg min-w-0">
        <p className="text-xs text-muted-foreground truncate flex-1 font-mono">
          {link}
        </p>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-brand hover:text-brand/80 transition-colors"
        >
          {copied ? (
            <CheckCheck className="size-3.5" />
          ) : (
            <Copy className="size-3.5" />
          )}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <button
        type="button"
        onClick={generate}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
      >
        <RefreshCw className="size-3" />
        {tx("regenerarCaducaEn7")}
      </button>
    </div>
  );
}
