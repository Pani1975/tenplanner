"use client";

// Torneos de prueba (sin cuenta): mismas pantallas que con cuenta, pero los
// datos viven en el navegador (lib/tournaments/guest).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  CalendarDays,
  ChevronRight,
  Info,
  Plus,
  Trash2,
  Trophy,
  Users,
} from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  GUEST_PATHS,
  TournamentApiProvider,
  type TournamentApi,
} from "@/app/(app)/torneos/tournament-api";
import { TournamentManager } from "@/app/(app)/torneos/[id]/tournament-manager";
import { guestFetch } from "@/lib/tournaments/guest/backend";
import {
  GUEST_CHANGED,
  loadGuestDb,
  type GuestDb,
} from "@/lib/tournaments/guest/store";
import { guestDetail, guestList } from "@/lib/tournaments/guest/view";
import { formatDateRange, STATUS_BADGE } from "@/lib/tournaments/labels";
import type { TournamentStatus } from "@/lib/tournaments/status";
import { cn } from "@/lib/utils";

/** Datos del navegador, recargados cada vez que cambian. */
function useGuestDb() {
  const [db, setDb] = useState<GuestDb | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(() => {
    loadGuestDb()
      .then(setDb)
      .catch(() => setFailed(true));
  }, []);
  useEffect(() => {
    reload();
    window.addEventListener(GUEST_CHANGED, reload);
    return () => window.removeEventListener(GUEST_CHANGED, reload);
  }, [reload]);
  return { db, failed, reload };
}

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<TournamentApi>(
    () => ({
      fetch: guestFetch,
      // Los datos se recargan solos al guardar (evento GUEST_CHANGED).
      refresh: () => window.dispatchEvent(new Event(GUEST_CHANGED)),
      guest: true,
      paths: GUEST_PATHS,
    }),
    []
  );
  return <TournamentApiProvider value={value}>{children}</TournamentApiProvider>;
}

/** Aviso del modo prueba: qué se puede hacer y qué pide una cuenta. */
export function GuestBanner() {
  const t = useTranslations("tournaments.guest");
  return (
    <div className="tp-card-soft flex items-start gap-3 p-4 text-sm">
      <Info className="mt-0.5 size-4 shrink-0 text-[var(--brand-ink)]" />
      <div className="space-y-1">
        <p className="font-semibold">{t("bannerTitle")}</p>
        <p className="text-foreground/75">{t("bannerText")}</p>
        <p>
          <Link href="/register" className="font-bold underline">
            {t("register")}
          </Link>{" "}
          <span className="text-foreground/60">· {t("keep")}</span>
        </p>
      </div>
    </div>
  );
}

function StorageError() {
  const t = useTranslations("tournaments.guest");
  return <p className="tp-card-soft p-6 text-sm">{t("storageError")}</p>;
}

export function GuestTournamentList() {
  const t = useTranslations("tournaments");
  const tg = useTranslations("tournaments.guest");
  const locale = useLocale();
  const { db, failed } = useGuestDb();
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(
    null
  );
  const rows = db ? guestList(db) : [];

  return (
    <div className="tp-page-pad mx-auto w-full max-w-5xl space-y-6">
      <header className="tp-card-blue flex flex-col gap-4 p-6 sm:flex-row sm:items-end sm:justify-between sm:p-8">
        <div>
          <p className="mb-3 inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-white/80">
            <Trophy className="size-4" />
            {tg("kicker")}
          </p>
          <h1 className="tp-title text-4xl leading-tight sm:text-5xl">
            {t("list.title")}
          </h1>
          <p className="mt-2 max-w-xl text-sm text-white/85">{tg("intro")}</p>
        </div>
        <Link
          href={GUEST_PATHS.create}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#d6f04a] px-5 text-sm font-bold text-black transition hover:bg-[#c5df3c]"
        >
          <Plus className="size-4" />
          {t("list.new")}
        </Link>
      </header>

      <GuestBanner />

      {failed ? (
        <StorageError />
      ) : !db ? null : rows.length === 0 ? (
        <div className="tp-card-soft p-8 text-center">
          <Trophy className="mx-auto mb-3 size-8 text-[var(--brand-ink)]" />
          <p className="tp-title text-xl">{tg("emptyTitle")}</p>
          <p className="mt-1 text-sm text-foreground/70">{tg("emptyText")}</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((r) => {
            const status = r.status as TournamentStatus;
            return (
              <li key={r.id} className="relative">
                <Link
                  href={GUEST_PATHS.detail(r.id)}
                  className="tp-card group flex h-full flex-col gap-3 p-5 transition hover:border-[var(--brand-ink)]"
                >
                  <div className="flex items-start justify-between gap-3 pr-10">
                    <h2 className="tp-title text-xl leading-snug">{r.name}</h2>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold",
                        STATUS_BADGE[status]
                      )}
                    >
                      {t(`status.${status}`)}
                    </span>
                  </div>
                  <p className="flex items-center gap-2 text-sm text-foreground/70">
                    <CalendarDays className="size-4" />
                    {formatDateRange(r.startDate, r.endDate, locale)}
                  </p>
                  <p className="text-sm text-foreground/70">
                    {t(`modality.${r.modality}`)} · {t(`format.${r.format}`)}
                  </p>
                  <div className="mt-auto flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-semibold">
                      <Users className="size-4 text-[var(--brand-ink)]" />
                      {r.maxEntries
                        ? t("list.spots", { taken: r.taken, max: r.maxEntries })
                        : t("list.entries", { count: r.taken })}
                    </span>
                    <ChevronRight className="size-4 text-foreground/40 transition group-hover:translate-x-0.5" />
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => setToDelete({ id: r.id, name: r.name })}
                  aria-label={tg("delete")}
                  title={tg("delete")}
                  className="absolute right-3 top-3 inline-flex size-9 items-center justify-center rounded-full text-foreground/50 hover:bg-foreground/5 hover:text-red-600"
                >
                  <Trash2 className="size-4" />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <ConfirmDialog
        open={toDelete !== null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={tg("deleteTitle")}
        description={toDelete ? tg("deleteText", { name: toDelete.name }) : undefined}
        confirmLabel={tg("delete")}
        destructive
        onConfirm={async () => {
          if (toDelete) {
            await guestFetch(`/api/tournaments/${toDelete.id}`, {
              method: "DELETE",
            });
          }
          setToDelete(null);
        }}
      />
    </div>
  );
}

export function GuestTournamentDetail({
  id,
  levels,
  baseUrl,
}: {
  id: string;
  levels: { code: string; label: string }[];
  baseUrl: string;
}) {
  const tg = useTranslations("tournaments.guest");
  const { db, failed } = useGuestDb();
  if (failed) return <StorageError />;
  if (!db) return null;
  const detail = guestDetail(db, id);
  if (!detail) {
    return (
      <div className="tp-page-pad mx-auto w-full max-w-5xl space-y-4">
        <p className="tp-card-soft p-6 text-sm">{tg("notFound")}</p>
        <Link href={GUEST_PATHS.list} className="font-bold underline">
          {tg("backToList")}
        </Link>
      </div>
    );
  }
  return (
    <>
      <div className="tp-page-pad mx-auto w-full max-w-5xl pb-0">
        <GuestBanner />
      </div>
      <TournamentManager
        tournament={detail.tournament}
        entries={detail.entries}
        matches={detail.matches}
        levels={levels}
        canSeeContacts
        baseUrl={baseUrl}
      />
    </>
  );
}
