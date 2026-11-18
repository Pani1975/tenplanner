"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Columns2, Square } from "lucide-react";
import { DateTimePicker } from "@/components/app/date-time-picker";
import { cn } from "@/lib/utils";
import {
  nextScheduleOccurrence,
  toLocalDateTimeInput,
} from "@/lib/groups/schedule";
import {
  saveTarget,
  targetToParams,
  type SessionTarget,
} from "@/lib/session-target";
import { defaultScheduledAt } from "./defaults";
import { StepStudents } from "./step-students";
import type { WizardState } from "./types";
import { useTranslations } from "next-intl";

type Who = Pick<
  WizardState,
  "studentIds" | "selectedGroupIds" | "groupId" | "groupName"
>;

interface SessionTargetStepProps {
  places: { id: string; name: string }[];
  /** Parámetros que ya traía la URL (por si se vuelve a este paso). */
  initial?: Partial<SessionTarget>;
}

/**
 * Primer paso de «Nueva sesión»: para quién es (un grupo, uno o varios
 * alumnos o alguien nuevo), cuándo y en cuántas pistas. Con eso decidido se
 * elige cómo montarla, y el nombre sale solo (AAMMDD_Grupo o AAMMDD_SG).
 */
export function SessionTargetStep({ places, initial }: SessionTargetStepProps) {
  const tx = useTranslations("ui.s_sessionwizard_sessiontargetstep");
  const router = useRouter();
  const [who, setWho] = useState<Who>({
    studentIds: initial?.studentIds ?? [],
    selectedGroupIds: initial?.groupId ? [initial.groupId] : [],
    groupId: initial?.groupId ?? null,
    groupName: "",
  });
  const [at, setAt] = useState(initial?.at || defaultScheduledAt());
  const [courts, setCourts] = useState<1 | 2>(initial?.courts === 2 ? 2 : 1);
  const [placeId, setPlaceId] = useState(initial?.placeId ?? "");
  const [placeId2, setPlaceId2] = useState(initial?.placeId2 ?? "");
  const [dateTouched, setDateTouched] = useState(!!initial?.at);

  function onGroupPicked(group: {
    weeklySchedule?: Parameters<typeof nextScheduleOccurrence>[0];
  }) {
    // Si el monitor aún no ha elegido día, se propone el próximo entreno.
    if (dateTouched) return;
    const next = nextScheduleOccurrence(group.weeklySchedule);
    if (next) setAt(toLocalDateTimeInput(next));
  }

  function next() {
    const target: SessionTarget = {
      groupId: who.groupId ?? null,
      // Con grupo, sus alumnos se cargan solos en el asistente.
      studentIds: who.groupId ? [] : who.studentIds,
      at,
      courts,
      placeId: placeId || null,
      placeId2: courts === 2 ? placeId2 || null : null,
    };
    saveTarget(target);
    const qs = targetToParams(target);
    qs.set("target", "1");
    router.push(`/sessions/new?${qs.toString()}`);
  }

  const card =
    "rounded-lg border border-[#050505]/10 bg-white p-5 shadow-[0_12px_36px_rgba(5,5,5,0.04)] dark:border-white/10 dark:bg-white/[0.045]";
  const label =
    "text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground";
  const select =
    "h-11 w-full rounded-lg border border-foreground/15 bg-background px-3 text-sm text-foreground";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pt-6">
      <section className={card}>
        <h2 className={cn(label, "mb-1")}>{tx("1ParaQuienEs")}</h2>
        <p className="mb-4 text-xs text-muted-foreground">
          {tx("unGrupoOUna")}
        </p>
        <StepStudents
          state={who as WizardState}
          update={(patch) => setWho((prev) => ({ ...prev, ...patch }))}
          onGroupPicked={onGroupPicked}
        />
      </section>

      <section className={card}>
        <h2 className={cn(label, "mb-3")}>{tx("2Cuando")}</h2>
        <DateTimePicker
          value={at}
          onChange={(v) => {
            setDateTouched(true);
            setAt(v);
          }}
        />
      </section>

      <section className={card}>
        <h2 className={cn(label, "mb-3")}>{tx("3UnaPistaO")}</h2>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              { value: 1, title: tx("unaPista"), Icon: Square },
              { value: 2, title: tx("dosPistas"), Icon: Columns2 },
            ] as const
          ).map(({ value, title, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCourts(value)}
              aria-pressed={courts === value}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-4 py-3 text-left text-sm font-semibold transition-colors",
                courts === value
                  ? "border-brand bg-brand/10 text-foreground"
                  : "border-foreground/15 text-muted-foreground hover:border-brand/50"
              )}
            >
              <Icon className="size-4" />
              {title}
            </button>
          ))}
        </div>
        {places.length > 0 && (
          <div
            className={cn(
              "mt-3 grid gap-3",
              courts === 2 && "sm:grid-cols-2"
            )}
          >
            <label className="flex flex-col gap-1 text-xs font-semibold text-foreground/70">
              {courts === 2 ? tx("courtPlace1") : tx("place")}{" "}{tx("opcional")}
              <select
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                className={select}
              >
                <option value="">{tx("sinLugarAsignado")}</option>
                {places.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {courts === 2 && (
              <label className="flex flex-col gap-1 text-xs font-semibold text-foreground/70">
                {tx("courtPlace2Optional")}
                <select
                  value={placeId2}
                  onChange={(e) => setPlaceId2(e.target.value)}
                  className={select}
                >
                  <option value="">{tx("sinLugarAsignado")}</option>
                  {places.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={next}
        className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full bg-[#D6FF38] px-6 text-sm font-bold text-[#050505] hover:bg-[#c8ef2f]"
      >
        {tx("continuar")}
        <ArrowRight className="size-4" />
      </button>
    </div>
  );
}
