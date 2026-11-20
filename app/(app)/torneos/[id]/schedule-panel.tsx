"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CalendarClock,
  Eye,
  EyeOff,
  Loader2,
  Pencil,
  TriangleAlert,
} from "lucide-react";
import { roundLabelKey } from "@/lib/tournaments/bracket";
import {
  scheduleByDay,
  scheduleClashes,
  zonedParts,
  zonedToIso,
} from "@/lib/tournaments/schedule";
import type { ScoringRules } from "@/lib/tournaments/score";
import { formatScore } from "@/lib/tournaments/score";
import { cn } from "@/lib/utils";
import { useApiError } from "../use-api-error";
import type { ManagerMatch } from "./draw-panel";
import { ScoreEditor, type EditableMatch } from "./score-editor";

type Row = { date: string; time: string; court: string };

/**
 * Orden de juego (torneos de club): día, hora y pista de cada partido.
 * Se guarda en borrador y se publica cuando está listo; desde el orden de
 * juego se mete el resultado de cada partido.
 */
export function SchedulePanel({
  tournamentId,
  format,
  matches,
  names,
  rules,
  places,
  published,
  canScore,
  timeZone,
}: {
  tournamentId: string;
  format: "knockout" | "round_robin";
  matches: (ManagerMatch & { scheduledAt: string | null })[];
  names: Record<string, string>;
  rules: ScoringRules;
  places: string[];
  published: boolean;
  canScore: boolean;
  timeZone: string;
}) {
  const t = useTranslations("tournaments");
  const locale = useLocale();
  const apiError = useApiError();
  const router = useRouter();
  const playable = useMemo(
    () =>
      matches
        .filter((m) => m.status !== "bye")
        .sort((a, b) => a.round - b.round || a.position - b.position),
    [matches]
  );
  const initial = useMemo(() => {
    const out: Record<string, Row> = {};
    for (const m of playable) {
      const p = m.scheduledAt
        ? zonedParts(new Date(m.scheduledAt), timeZone)
        : null;
      out[m.id] = {
        date: p?.date ?? "",
        time: p?.time ?? "",
        court: m.courtLabel ?? "",
      };
    }
    return out;
  }, [playable, timeZone]);
  const [rows, setRows] = useState(initial);
  // Fila de un partido: lo editado o, si es un partido nuevo (p. ej. tras
  // rehacer el cuadro), lo que trae el partido. Nunca undefined.
  const rowOf = (id: string): Row =>
    rows[id] ?? initial[id] ?? { date: "", time: "", court: "" };
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [scoring, setScoring] = useState<EditableMatch | null>(null);

  const total = Math.max(0, ...matches.map((m) => m.round));
  const roundTitle = (r: number) => {
    if (format === "round_robin") return t("public.matchday", { n: r });
    const k = roundLabelKey(r, total);
    return k.key === "round_of"
      ? t("public.roundOf", { size: k.size ?? 0 })
      : t(`public.${k.key}`);
  };
  const name = (id: string | null) =>
    id ? (names[id] ?? t("public.tbd")) : t("public.tbd");
  const dirty = playable.some((m) => {
    const a = rowOf(m.id);
    const b = initial[m.id] ?? a;
    return a.date !== b.date || a.time !== b.time || a.court !== b.court;
  });
  const incomplete = playable.filter((m) => {
    const r = rowOf(m.id);
    return !!r.date !== !!r.time;
  });

  const scheduled = scheduleByDay(playable, timeZone);
  const clashes = scheduleClashes(playable);

  async function save() {
    if (incomplete.length) {
      toast.error(t("schedule.incomplete"));
      return;
    }
    setBusy("save");
    const res = await fetch(`/api/tournaments/${tournamentId}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: playable.map((m) => {
          const r = rowOf(m.id);
          return {
            matchId: m.id,
            scheduledAt:
              r.date && r.time ? zonedToIso(r.date, r.time, timeZone) : null,
            courtLabel: r.court.trim() || null,
          };
        }),
      }),
    });
    setBusy(null);
    if (!res.ok) return toast.error(await apiError(res));
    toast.success(t("schedule.saved"));
    setEditing(false);
    router.refresh();
  }

  async function publish(v: boolean) {
    setBusy("publish");
    const res = await fetch(`/api/tournaments/${tournamentId}/schedule`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ published: v }),
    });
    setBusy(null);
    if (!res.ok) return toast.error(await apiError(res));
    toast.success(
      t(v ? "schedule.publishedToast" : "schedule.unpublishedToast")
    );
    router.refresh();
  }

  const dayLabel = (d: string) => {
    const [y, m, dd] = d.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    }).format(new Date(Date.UTC(y, m - 1, dd)));
  };

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="tp-title flex items-center gap-2 text-2xl">
          <CalendarClock className="size-5" />
          {t("schedule.title")}
        </h2>
        <span
          className={cn(
            "rounded-full px-3 py-1 text-xs font-bold",
            published
              ? "bg-emerald-600 text-white"
              : "bg-foreground/10 text-foreground/70"
          )}
        >
          {published ? t("schedule.isPublished") : t("schedule.notPublished")}
        </span>
      </div>
      <p className="text-sm text-foreground/70">
        {published ? t("schedule.helpPublished") : t("schedule.help")}
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            if (editing) setRows(initial);
            setEditing(!editing);
          }}
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-black px-5 text-sm font-bold text-white dark:bg-[#d6f04a] dark:text-black"
        >
          <Pencil className="size-4" />
          {editing ? t("schedule.cancelEdit") : t("schedule.edit")}
        </button>
        {!editing && scheduled.length > 0 && (
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => publish(!published)}
            className={cn(
              "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-bold disabled:opacity-50",
              published ? "bg-foreground/10" : "bg-[#d6f04a] text-black"
            )}
          >
            {busy === "publish" ? (
              <Loader2 className="size-4 animate-spin" />
            ) : published ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
            {published ? t("schedule.unpublish") : t("schedule.publish")}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          {[...new Set(playable.map((m) => m.round))].map((r) => (
            <div key={r} className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-foreground/60">
                {roundTitle(r)}
              </h3>
              <ul className="space-y-2">
                {playable
                  .filter((m) => m.round === r)
                  .map((m) => {
                    const row = rowOf(m.id);
                    const set = (patch: Partial<Row>) =>
                      setRows({ ...rows, [m.id]: { ...row, ...patch } });
                    return (
                      <li key={m.id} className="tp-card space-y-2 p-3">
                        <p className="text-sm font-semibold">
                          {name(m.entryAId)}{" "}
                          <span className="font-normal text-foreground/50">
                            {t("schedule.vs")}
                          </span>{" "}
                          {name(m.entryBId)}
                        </p>
                        <div className="grid grid-cols-[1fr_6.5rem] gap-2 sm:grid-cols-[10rem_7rem_1fr]">
                          <input
                            type="date"
                            value={row.date}
                            onChange={(e) => set({ date: e.target.value })}
                            aria-label={t("schedule.date")}
                            className="tp-field h-11 w-full px-3 text-base"
                          />
                          <input
                            type="time"
                            step={300}
                            value={row.time}
                            onChange={(e) => set({ time: e.target.value })}
                            aria-label={t("schedule.time")}
                            className="tp-field h-11 w-full px-3 text-base"
                          />
                          <input
                            value={row.court}
                            onChange={(e) => set({ court: e.target.value })}
                            maxLength={60}
                            list={`courts-${tournamentId}`}
                            placeholder={t("schedule.court")}
                            aria-label={t("schedule.court")}
                            className="tp-field col-span-2 h-11 w-full px-3 text-base sm:col-span-1"
                          />
                        </div>
                      </li>
                    );
                  })}
              </ul>
            </div>
          ))}
          <datalist id={`courts-${tournamentId}`}>
            {places.map((p) => (
              <option key={p} value={p} />
            ))}
          </datalist>
          <div className="sticky bottom-3 flex justify-end">
            <button
              type="button"
              disabled={busy !== null || !dirty}
              onClick={save}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-6 text-sm font-bold text-black shadow-lg disabled:opacity-50"
            >
              {busy === "save" && <Loader2 className="size-4 animate-spin" />}
              {t("schedule.save")}
            </button>
          </div>
        </div>
      ) : scheduled.length === 0 ? (
        <p className="tp-card-soft p-4 text-sm">{t("schedule.empty")}</p>
      ) : (
        <div className="space-y-4">
          {scheduled.map((day) => (
            <div key={day.date} className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-foreground/60">
                {dayLabel(day.date)}
              </h3>
              <ul className="tp-card divide-y divide-foreground/10">
                {day.items.map((m) => {
                  const scorable = canScore && !!m.entryAId && !!m.entryBId;
                  return (
                    <li
                      key={m.id}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      <div className="w-14 shrink-0">
                        <p className="font-bold tabular-nums">{m.time}</p>
                        {m.courtLabel && (
                          <p className="truncate text-xs text-foreground/60">
                            {m.courtLabel}
                          </p>
                        )}
                      </div>
                      <div className="min-w-0 flex-1 text-sm">
                        <p className="leading-snug">
                          <span
                            className={cn(
                              m.winnerEntryId &&
                                m.winnerEntryId === m.entryAId &&
                                "font-bold"
                            )}
                          >
                            {name(m.entryAId)}
                          </span>{" "}
                          <span className="text-foreground/50">
                            {t("schedule.vs")}
                          </span>{" "}
                          <span
                            className={cn(
                              m.winnerEntryId &&
                                m.winnerEntryId === m.entryBId &&
                                "font-bold"
                            )}
                          >
                            {name(m.entryBId)}
                          </span>
                        </p>
                        <p className="text-xs text-foreground/60">
                          {roundTitle(m.round)}
                          {m.status === "played" &&
                            ` · ${
                              m.resultType === "walkover"
                                ? t("public.walkover")
                                : m.score
                                  ? formatScore(m.score)
                                  : ""
                            }`}
                        </p>
                        {clashes.has(m.id) && (
                          <p className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
                            <TriangleAlert className="size-3.5" />
                            {t("schedule.clash")}
                          </p>
                        )}
                      </div>
                      {scorable && (
                        <button
                          type="button"
                          onClick={() =>
                            setScoring({
                              id: m.id,
                              aName: name(m.entryAId),
                              bName: name(m.entryBId),
                              status: m.status,
                              resultType: m.resultType,
                              score: m.score,
                              winner:
                                m.winnerEntryId === null
                                  ? null
                                  : m.winnerEntryId === m.entryAId
                                    ? "a"
                                    : "b",
                              courtLabel: m.courtLabel,
                            })
                          }
                          className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-foreground/10 px-4 text-xs font-bold"
                        >
                          {m.status === "played"
                            ? t("schedule.editResult")
                            : t("schedule.result")}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {scoring && (
        <ScoreEditor
          tournamentId={tournamentId}
          match={scoring}
          rules={rules}
          onClose={() => setScoring(null)}
          onSaved={() => {
            setScoring(null);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
