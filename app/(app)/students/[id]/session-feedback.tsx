"use client";

import { useState, useTransition } from "react";
import { Check, X, Loader2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { saveSessionFeedback } from "./actions";
import { useTranslations } from "next-intl";

type Props = {
  sessionStudentId: string;
  studentId: string;
  initialAttended: boolean | null;
  initialRating: number | null;
  initialFeedback: string | null;
};

export function SessionFeedback({
  sessionStudentId,
  studentId,
  initialAttended,
  initialRating,
  initialFeedback,
}: Props) {
  const tx = useTranslations("ui.s_id_sessionfeedback");
  const [attended, setAttended] = useState<boolean | null>(initialAttended);
  const [rating, setRating] = useState<number | null>(initialRating);
  const [feedback, setFeedback] = useState<string>(initialFeedback ?? "");
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function save(
    nextAttended: boolean | null,
    nextRating: number | null,
    nextFeedback: string
  ) {
    setSaved(false);
    startTransition(async () => {
      const res = await saveSessionFeedback({
        sessionStudentId,
        studentId,
        attended: nextAttended,
        rating: nextRating,
        feedback: nextFeedback,
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    });
  }

  return (
    <div className="space-y-3 mt-3 pt-3 border-t border-border/60">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {tx("asistencia")}
        </span>
        <button
          type="button"
          onClick={() => {
            const v = attended === true ? null : true;
            setAttended(v);
            save(v, rating, feedback);
          }}
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors",
            attended === true
              ? "bg-brand/15 border-brand/40 text-brand"
              : "bg-background border-border text-muted-foreground hover:border-brand/30"
          )}
        >
          <Check className="size-3" />{" "}{tx("asistio")}
        </button>
        <button
          type="button"
          onClick={() => {
            const v = attended === false ? null : false;
            setAttended(v);
            save(v, rating, feedback);
          }}
          className={cn(
            "inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors",
            attended === false
              ? "bg-destructive/15 border-destructive/40 text-destructive"
              : "bg-background border-border text-muted-foreground hover:border-destructive/30"
          )}
        >
          <X className="size-3" />{" "}{tx("falto")}
        </button>

        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-muted-foreground">
          {isPending && <Loader2 className="size-3 animate-spin" />}
          {saved && !isPending && (
            <span className="text-brand font-medium">{tx("guardado")}</span>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {tx("valoracion")}
        </span>
        <div className="flex gap-0.5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                const v = rating === n ? null : n;
                setRating(v);
                save(attended, v, feedback);
              }}
              className="p-0.5 hover:scale-110 transition-transform"
              aria-label={`${n} estrellas`}
            >
              <Star
                className={cn(
                  "size-4 transition-colors",
                  rating != null && n <= rating
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/40"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <textarea
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        onBlur={() => save(attended, rating, feedback)}
        rows={2}
        placeholder={tx("feedbackBreveSobreLa")}
        className="w-full text-sm bg-background border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand/30 resize-none"
      />
    </div>
  );
}
