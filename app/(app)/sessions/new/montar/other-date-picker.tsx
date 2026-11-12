"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ChevronDown } from "lucide-react";
import { ClassDatesCalendar } from "@/components/app/class-dates-calendar";
import {
  toLocalDateTimeInput,
  type GroupScheduleEntry,
} from "@/lib/groups/schedule";
import { MONTAR } from "@/lib/session-engine/messages";

/**
 * "Otro día": el mismo calendario que al asignar una clase a un grupo
 * (con sus días habituales marcados), pero de una sola fecha.
 */
export function OtherDatePicker({
  groupId,
  schedule,
}: {
  groupId: string;
  schedule: GroupScheduleEntry[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  return (
    <div className="rounded-lg border border-[#050505]/10 bg-white dark:border-white/10 dark:bg-white/[0.045]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#D6FF38]/20 text-brand">
          <CalendarPlus className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-foreground">
            {MONTAR.otherDate}
          </span>
          <span className="block text-xs text-muted-foreground">
            {MONTAR.otherDateHint}
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-foreground/40 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-foreground/10">
          <ClassDatesCalendar
            schedule={schedule}
            single
            busy={busy}
            confirmLabel={MONTAR.pickDay}
            onConfirm={(dates) => {
              if (dates.length === 0) return;
              setBusy(true);
              const qs = new URLSearchParams({
                group: groupId,
                at: toLocalDateTimeInput(dates[0]),
              });
              router.push(`/sessions/new/montar?${qs.toString()}`);
            }}
          />
        </div>
      )}
    </div>
  );
}
