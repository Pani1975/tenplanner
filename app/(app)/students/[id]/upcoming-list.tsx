"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";

export type UpcomingItem = {
  ssId: string;
  sessionId: string;
  title: string;
  scheduledAt: string;
  durationMinutes: number;
};

const PAGE_SIZE = 5;

export function UpcomingList({ items }: { items: UpcomingItem[] }) {
  const intlLocale = useLocale() === "en" ? "en-GB" : "es-ES";
  const tx = useTranslations("ui.s_id_upcominglist");
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {tx("sinSesionesFuturasAsignadas")}
      </p>
    );
  }

  const shown = items.slice(0, visible);
  const hasMore = visible < items.length;

  const fmtDate = (iso: string) =>
    new Intl.DateTimeFormat(intlLocale, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));

  return (
    <div className="space-y-2">
      {shown.map((s) => (
        <Link
          key={s.ssId}
          href={`/sessions/${s.sessionId}`}
          className="group flex items-center gap-3 p-3 rounded-xl border border-border hover:border-brand/40 hover:bg-brand/5 transition-colors"
        >
          <div className="size-9 rounded-lg bg-brand/10 flex items-center justify-center shrink-0">
            <Calendar className="size-4 text-brand" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground truncate group-hover:text-brand transition-colors">
              {s.title}
            </p>
            <p className="text-xs text-muted-foreground">
              {tx("v1V2Min", { v1: fmtDate(s.scheduledAt), v2: s.durationMinutes })}</p>
          </div>
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        </Link>
      ))}

      {hasMore && (
        <button
          type="button"
          onClick={() => setVisible((v) => v + PAGE_SIZE)}
          className="w-full text-xs font-semibold text-muted-foreground hover:text-brand border border-border hover:border-brand/30 rounded-lg py-2 transition-colors"
        >
          {tx("verV1MasV2", { v1: Math.min(PAGE_SIZE, items.length - visible), v2: items.length - visible })}</button>
      )}
      {!hasMore && items.length > PAGE_SIZE && (
        <button
          type="button"
          onClick={() => setVisible(PAGE_SIZE)}
          className="w-full text-xs text-muted-foreground hover:text-foreground py-1 transition-colors"
        >
          {tx("mostrarMenos")}
        </button>
      )}
    </div>
  );
}
