"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Camera,
  CalendarDays,
  EyeOff,
  Loader2,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PublicLinks } from "./public-links";
import { MediaPanel } from "./media-panel";
import { PosterPanel } from "./poster-panel";
import { SchedulePanel } from "./schedule-panel";
import type { TournamentTimeZone } from "@/lib/tournaments/schedule";
import { DrawPanel, type ManagerMatch } from "./draw-panel";
import { DrawButton } from "./draw-button";
import { EditTournamentForm } from "./edit-tournament-form";
import type { ScoringRules } from "@/lib/tournaments/score";
import { cn } from "@/lib/utils";
import {
  ENTRY_BADGE,
  formatDateRange,
  STATUS_BADGE_ON_DARK,
} from "@/lib/tournaments/labels";
import {
  canEditEntries,
  canTransition,
  type TournamentStatus,
} from "@/lib/tournaments/status";
import { waitlistPosition, type EntryStatus } from "@/lib/tournaments/entries";
import { useApiError } from "../use-api-error";
import { StudentPicker } from "./student-picker";
import { ExternalEntryForm } from "./external-entry-form";

export type ManagerTournament = {
  id: string;
  name: string;
  slug: string;
  status: string;
  effectiveStatus: string;
  modality: "singles" | "doubles";
  format: "knockout" | "round_robin";
  levelCode: string | null;
  startDate: string;
  endDate: string | null;
  registrationDeadline: string | null;
  maxEntries: number | null;
  isClub: boolean;
  visibility: "public" | "private";
  photosPublic: boolean;
  posterTemplate: "classic" | "court" | "image";
  hasPosterImage: boolean;
  archived: boolean;
  canArchive: boolean;
  schedulePublished: boolean;
  places: string[];
  timeZone: TournamentTimeZone;
  description: string | null;
  rules: ScoringRules;
  circuit: { name: string; season: string | null; slug: string } | null;
};

export type ManagerEntry = {
  id: string;
  source: string;
  status: string;
  studentId: string | null;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  isMinor: boolean;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  levelCode: string | null;
  partnerFirstName: string | null;
  partnerLastName: string | null;
  partnerIsMinor: boolean;
  partnerEmail: string | null;
  partnerPhone: string | null;
  partnerGuardianName: string | null;
  partnerGuardianEmail: string | null;
  partnerGuardianPhone: string | null;
  consentAt: string | null;
  consentMethod: string | null;
  createdAt: string;
  contactsHidden: boolean;
  seed: number | null;
  // Autorización de imagen del jugador y de la pareja (null si no hay).
  image: {
    player: "yes" | "no" | "unknown";
    partner: "yes" | "no" | "unknown" | null;
  };
};

type Level = { code: string; label: string };

// Acciones de estado que ofrece la cabecera, en orden.
const STATUS_ACTIONS: { to: TournamentStatus; key: string }[] = [
  { to: "open", key: "open" },
  { to: "closed", key: "close" },
  { to: "draft", key: "draft" },
  { to: "finished", key: "finish" },
  { to: "in_progress", key: "reopenResults" },
];

const fullName = (first: string | null, last: string | null) =>
  [first, last].filter(Boolean).join(" ");

export function TournamentManager({
  tournament: t,
  entries,
  matches,
  levels,
  canSeeContacts,
  baseUrl,
}: {
  tournament: ManagerTournament;
  entries: ManagerEntry[];
  matches: (ManagerMatch & { scheduledAt: string | null })[];
  levels: Level[];
  canSeeContacts: boolean;
  baseUrl: string;
}) {
  const tr = useTranslations("tournaments");
  const locale = useLocale();
  const router = useRouter();
  const apiError = useApiError();
  const [panel, setPanel] = useState<"none" | "students" | "external">("none");
  const [busy, setBusy] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<ManagerEntry | null>(null);
  const [editingData, setEditingData] = useState(false);
  const matchCount = matches.length;
  const anyPlayed = matches.some((m) => m.status === "played");
  const allPlayed =
    matchCount > 0 &&
    matches.every((m) => m.status === "played" || m.status === "bye");
  const names = useMemo(
    () =>
      Object.fromEntries(
        entries.map((e) => [
          e.id,
          e.partnerFirstName
            ? `${fullName(e.firstName, e.lastName)} / ${fullName(e.partnerFirstName, e.partnerLastName)}`
            : fullName(e.firstName, e.lastName),
        ])
      ),
    [entries]
  );

  const statusInput = {
    status: t.status as TournamentStatus,
    registrationDeadline: t.registrationDeadline,
  };
  const status = t.effectiveStatus as TournamentStatus;
  const editable = canEditEntries(statusInput);
  // Cabezas de serie: en eliminatoria, antes de generar el cuadro.
  const seedable = t.format === "knockout" && matchCount === 0 && editable;
  const levelLabel = (code: string | null) =>
    code ? (levels.find((l) => l.code === code)?.label ?? code) : null;

  const queue = useMemo(
    () =>
      entries.map((e) => ({
        id: e.id,
        status: e.status as EntryStatus,
        createdAt: e.createdAt,
        hasConsent: !!e.consentAt,
      })),
    [entries]
  );
  const groups = {
    confirmed: entries.filter((e) => e.status === "confirmed"),
    pending: entries.filter((e) => e.status === "pending"),
    waitlist: [...entries.filter((e) => e.status === "waitlist")].sort(
      (a, b) =>
        (waitlistPosition(queue, a.id) ?? 0) -
        (waitlistPosition(queue, b.id) ?? 0)
    ),
    cancelled: entries.filter((e) => e.status === "cancelled"),
  };
  const taken = groups.confirmed.length + groups.pending.length;

  async function archive(archived: boolean) {
    setBusy("archive");
    const res = await fetch(`/api/tournaments/${t.id}/archive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ archived }),
    });
    setBusy(null);
    if (!res.ok) {
      toast.error(await apiError(res));
      return;
    }
    toast.success(tr(archived ? "archive.done" : "archive.restored"));
    if (archived) router.push("/torneos");
    else router.refresh();
  }

  async function patchTournament(body: object, key: string) {
    setBusy(key);
    const res = await fetch(`/api/tournaments/${t.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      toast.error(await apiError(res));
      return;
    }
    const { data } = await res.json();
    if (data?.promoted?.length) {
      toast.success(tr("manager.promoted", { count: data.promoted.length }));
    }
    router.refresh();
  }

  async function patchEntry(entryId: string, body: object) {
    setBusy(entryId);
    const res = await fetch(`/api/tournaments/${t.id}/entries/${entryId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(null);
    if (!res.ok) {
      toast.error(await apiError(res));
      return false;
    }
    const { data } = await res.json();
    if (data?.promoted?.length) {
      toast.success(tr("manager.promoted", { count: data.promoted.length }));
    }
    router.refresh();
    return true;
  }

  const actions = STATUS_ACTIONS.filter(
    (a) =>
      canTransition(statusInput, a.to) &&
      // "En curso" solo se alcanza generando el cuadro (fase de resultados).
      !(a.to === "in_progress" && matchCount === 0) &&
      !(status === "closed" && a.to === "in_progress") &&
      // Finalizar solo cuando se han jugado todos los partidos.
      !(a.to === "finished" && !allPlayed)
  );

  return (
    <div className="tp-page-pad mx-auto w-full max-w-5xl space-y-5">
      <Link
        href="/torneos"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground/60 hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        {tr("manager.back")}
      </Link>

      <header className="tp-card-blue space-y-4 p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-[11px] font-bold",
              STATUS_BADGE_ON_DARK[status]
            )}
          >
            {tr(`status.${status}`)}
          </span>
          {t.archived && (
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-bold">
              {tr("archive.badge")}
            </span>
          )}
          <span className="text-xs font-semibold text-white/80">
            {tr(`modality.${t.modality}`)} · {tr(`format.${t.format}`)}
            {t.levelCode && ` · ${levelLabel(t.levelCode)}`}
          </span>
        </div>
        <p className="text-xs font-bold uppercase tracking-wide text-white/85">
          {t.circuit
            ? tr("manager.circuit", {
                name: t.circuit.season
                  ? `${t.circuit.name} · ${t.circuit.season}`
                  : t.circuit.name,
              })
            : tr("wizard.independent")}
        </p>
        <h1 className="tp-title text-3xl leading-tight sm:text-5xl">
          {t.name}
        </h1>
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-white/85">
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-4" />
            {formatDateRange(t.startDate, t.endDate, locale)}
          </span>
          <span className="flex items-center gap-1.5">
            <Users className="size-4" />
            {t.maxEntries
              ? tr("list.spots", { taken, max: t.maxEntries })
              : tr("list.entries", { count: taken })}
          </span>
          {t.registrationDeadline && (
            <span>
              {tr("manager.deadline", {
                date: new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: t.timeZone,
                }).format(new Date(t.registrationDeadline)),
              })}
            </span>
          )}
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {actions.map((a, i) => (
              <button
                key={a.to}
                type="button"
                disabled={busy !== null}
                onClick={() => patchTournament({ status: a.to }, a.to)}
                className={cn(
                  "inline-flex h-11 items-center gap-2 rounded-full px-5 text-sm font-bold disabled:opacity-50",
                  i === 0
                    ? "bg-[#d6f04a] text-black"
                    : "bg-white/15 text-white hover:bg-white/25"
                )}
              >
                {busy === a.to && <Loader2 className="size-4 animate-spin" />}
                {tr(`manager.action.${a.key}`)}
              </button>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {status === "closed" && matchCount === 0 && (
            <DrawButton tournamentId={t.id} redraw={false} />
          )}
          {status === "in_progress" && matchCount > 0 && !anyPlayed && (
            <DrawButton tournamentId={t.id} redraw variant="secondary" />
          )}
          {(t.archived || t.canArchive) && (
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => archive(!t.archived)}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white/15 px-5 text-sm font-bold text-white hover:bg-white/25 disabled:opacity-50"
            >
              {busy === "archive" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : t.archived ? (
                <ArchiveRestore className="size-4" />
              ) : (
                <Archive className="size-4" />
              )}
              {t.archived ? tr("archive.restore") : tr("archive.archive")}
            </button>
          )}
          {status !== "finished" && (
            <button
              type="button"
              onClick={() => setEditingData((v) => !v)}
              aria-expanded={editingData}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-white/15 px-5 text-sm font-bold text-white hover:bg-white/25"
            >
              {tr("edit.open")}
            </button>
          )}
        </div>
        {status === "closed" && matchCount === 0 && (
          <p className="text-sm text-white/85">{tr("manager.drawSoon")}</p>
        )}
      </header>

      {editingData && (
        <EditTournamentForm
          tournament={{
            id: t.id,
            name: t.name,
            description: t.description,
            startDate: t.startDate,
            endDate: t.endDate,
            registrationDeadline: t.registrationDeadline,
            maxEntries: t.maxEntries,
            timeZone: t.timeZone,
          }}
          onDone={() => {
            setEditingData(false);
            router.refresh();
          }}
          onCancel={() => setEditingData(false)}
        />
      )}

      {matchCount > 0 && (
        <DrawPanel
          tournamentId={t.id}
          format={t.format}
          matches={matches}
          names={names}
          rules={t.rules}
          canEdit={status === "in_progress"}
        />
      )}

      {matchCount > 0 && t.isClub && (
        <SchedulePanel
          tournamentId={t.id}
          format={t.format}
          matches={matches}
          names={names}
          rules={t.rules}
          places={t.places}
          published={t.schedulePublished}
          timeZone={t.timeZone}
          canScore={status === "in_progress"}
        />
      )}

      <PublicLinks
        tournamentId={t.id}
        slug={t.slug}
        isDraft={t.status === "draft"}
        visibility={t.visibility}
        isClub={t.isClub}
        circuitSlug={t.circuit?.slug ?? null}
        baseUrl={baseUrl}
      />

      {!canSeeContacts && t.isClub && (
        <p className="tp-card-soft flex items-start gap-2 p-4 text-sm">
          <EyeOff className="mt-0.5 size-4 shrink-0" />
          {tr("manager.contactsHidden")}
        </p>
      )}

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="tp-title text-2xl">{tr("manager.entriesTitle")}</h2>
          {editable && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  setPanel(panel === "students" ? "none" : "students")
                }
                aria-expanded={panel === "students"}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-5 text-sm font-bold text-black"
              >
                <Users className="size-4" />
                {tr("manager.addStudents")}
              </button>
              <button
                type="button"
                onClick={() =>
                  setPanel(panel === "external" ? "none" : "external")
                }
                aria-expanded={panel === "external"}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-[var(--brand-muted)] px-5 text-sm font-bold text-foreground"
              >
                <UserPlus className="size-4" />
                {tr("manager.addExternal")}
              </button>
            </div>
          )}
        </div>

        {!editable && (
          <p className="text-sm text-foreground/65">
            {tr("manager.entriesLocked")}
          </p>
        )}

        {panel === "students" && (
          <StudentPicker
            tournamentId={t.id}
            doubles={t.modality === "doubles"}
            levels={levels}
            onDone={() => {
              setPanel("none");
              router.refresh();
            }}
            onCancel={() => setPanel("none")}
          />
        )}
        {panel === "external" && (
          <ExternalEntryForm
            tournamentId={t.id}
            doubles={t.modality === "doubles"}
            levels={levels}
            onDone={() => {
              setPanel("none");
              router.refresh();
            }}
            onCancel={() => setPanel("none")}
          />
        )}

        {entries.length === 0 ? (
          <div className="tp-card-soft p-6 text-sm">
            {tr("manager.noEntries")}
          </div>
        ) : (
          (["confirmed", "pending", "waitlist", "cancelled"] as const).map(
            (g) =>
              groups[g].length > 0 && (
                <div key={g} className="space-y-2">
                  <h3 className="text-xs font-bold uppercase text-foreground/60">
                    {tr(`entryGroup.${g}`)} ({groups[g].length})
                  </h3>
                  {g === "pending" && (
                    <p className="text-sm text-foreground/70">
                      {tr("manager.pendingHelp")}
                    </p>
                  )}
                  <ul className="space-y-2">
                    {groups[g].map((e) => (
                      <EntryRow
                        key={e.id}
                        entry={e}
                        position={
                          g === "waitlist"
                            ? waitlistPosition(queue, e.id)
                            : null
                        }
                        levelLabel={levelLabel(e.levelCode)}
                        busy={busy === e.id}
                        editable={editable}
                        seedOptions={
                          seedable && g === "confirmed"
                            ? Math.min(8, groups.confirmed.length)
                            : 0
                        }
                        onSeed={(seed) =>
                          patchEntry(e.id, { action: "seed", seed })
                        }
                        onConsent={() =>
                          patchEntry(e.id, { action: "declare_consent" })
                        }
                        onCancel={() => setToCancel(e)}
                      />
                    ))}
                  </ul>
                </div>
              )
          )
        )}
      </section>

      <PosterPanel
        tournamentId={t.id}
        template={t.posterTemplate}
        hasImage={t.hasPosterImage}
        isPrivate={t.visibility === "private"}
      />

      {t.status !== "draft" && (
        <MediaPanel
          tournamentId={t.id}
          photosPublic={t.photosPublic}
          isPublic={t.visibility === "public"}
        />
      )}

      <ConfirmDialog
        open={toCancel !== null}
        onOpenChange={(open) => !open && setToCancel(null)}
        title={tr("manager.cancelTitle")}
        description={
          toCancel
            ? tr("manager.cancelText", {
                name: fullName(toCancel.firstName, toCancel.lastName),
              })
            : undefined
        }
        confirmLabel={tr("manager.cancelConfirm")}
        destructive
        onConfirm={async () => {
          if (toCancel) await patchEntry(toCancel.id, { action: "cancel" });
          setToCancel(null);
        }}
      />
    </div>
  );
}

function EntryRow({
  entry: e,
  position,
  levelLabel,
  busy,
  editable,
  seedOptions,
  onSeed,
  onConsent,
  onCancel,
}: {
  entry: ManagerEntry;
  position: number | null;
  levelLabel: string | null;
  busy: boolean;
  editable: boolean;
  seedOptions: number;
  onSeed: (seed: number | null) => void;
  onConsent: () => void;
  onCancel: () => void;
}) {
  const tr = useTranslations("tournaments");
  const name = fullName(e.firstName, e.lastName);
  const partner = e.partnerFirstName
    ? fullName(e.partnerFirstName, e.partnerLastName)
    : null;
  const contact = e.isMinor
    ? [e.guardianName, e.guardianEmail, e.guardianPhone].filter(Boolean)
    : [e.email, e.phone].filter(Boolean);
  const partnerContact = !partner
    ? []
    : e.partnerIsMinor
      ? [
          e.partnerGuardianName,
          e.partnerGuardianEmail,
          e.partnerGuardianPhone,
        ].filter(Boolean)
      : [e.partnerEmail, e.partnerPhone].filter(Boolean);

  return (
    <li className="tp-card flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <p className="font-semibold">
          {position !== null && (
            <span className="mr-2 text-[var(--brand-ink)]">#{position}</span>
          )}
          {name}
          {partner && <span className="text-foreground/60"> / {partner}</span>}
        </p>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span
            className={cn(
              "rounded-full px-2 py-0.5 font-bold",
              ENTRY_BADGE[e.status]
            )}
          >
            {tr(`entryStatus.${e.status}`)}
          </span>
          <span className="rounded-full bg-foreground/5 px-2 py-0.5 font-semibold">
            {tr(`source.${e.source}`)}
          </span>
          {(e.isMinor || e.partnerIsMinor) && (
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 font-semibold">
              {tr("manager.minor")}
            </span>
          )}
          {levelLabel && (
            <span className="rounded-full bg-foreground/5 px-2 py-0.5 font-semibold">
              {levelLabel}
            </span>
          )}
          <ImageBadge image={e.image} hasPartner={!!partner} />
          {e.consentAt && (
            <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
              <ShieldCheck className="size-3.5" />
              {tr(`consent.${e.consentMethod ?? "form"}`)}
            </span>
          )}
        </div>
        {!e.contactsHidden && contact.length > 0 && (
          <p className="break-all text-xs text-foreground/65">
            {partner && `${e.firstName}: `}
            {e.isMinor && `${tr("manager.guardian")}: `}
            {contact.join(" · ")}
          </p>
        )}
        {!e.contactsHidden && partnerContact.length > 0 && (
          <p className="break-all text-xs text-foreground/65">
            {`${e.partnerFirstName}: `}
            {e.partnerIsMinor && `${tr("manager.guardian")}: `}
            {partnerContact.join(" · ")}
          </p>
        )}
      </div>
      {editable && e.status !== "cancelled" && (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {seedOptions > 0 && (
            <label className="inline-flex min-h-11 items-center gap-2 rounded-full bg-foreground/5 pl-4 pr-2 text-sm font-semibold">
              {tr("draw.seed")}
              <select
                value={e.seed ?? ""}
                disabled={busy}
                onChange={(ev) =>
                  onSeed(ev.target.value ? Number(ev.target.value) : null)
                }
                className="h-9 rounded-full bg-background px-2 text-sm"
              >
                <option value="">–</option>
                {Array.from({ length: seedOptions }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {i + 1}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!e.consentAt && (
            <button
              type="button"
              onClick={onConsent}
              disabled={busy}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[#d6f04a] px-4 text-sm font-bold text-black disabled:opacity-50"
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ShieldCheck className="size-4" />
              )}
              {tr("manager.declareConsent")}
            </button>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-foreground/5 px-4 text-sm font-semibold disabled:opacity-50"
          >
            <XCircle className="size-4" />
            {tr("manager.cancelEntry")}
          </button>
        </div>
      )}
    </li>
  );
}

/** Autorización de imagen (de la ficha del alumno o de la inscripción). */
function ImageBadge({
  image,
  hasPartner,
}: {
  image: ManagerEntry["image"];
  hasPartner: boolean;
}) {
  const tr = useTranslations("tournaments.imageConsent");
  const all = [
    image.player,
    ...(hasPartner && image.partner ? [image.partner] : []),
  ];
  const state = all.every((x) => x === "yes")
    ? "yes"
    : all.some((x) => x === "no")
      ? "no"
      : "unknown";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold",
        state === "yes"
          ? "bg-emerald-600/10 text-emerald-700 dark:text-emerald-400"
          : state === "no"
            ? "bg-red-600/10 text-red-700 dark:text-red-400"
            : "bg-foreground/5 text-foreground/70"
      )}
    >
      <Camera className="size-3.5" />
      {tr(`badge.${state}`)}
    </span>
  );
}
