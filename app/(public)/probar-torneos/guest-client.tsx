"use client";

// Modo prueba de torneos (sin cuenta): mismas pantallas que con cuenta y la
// misma API; el servidor reconoce el torneo por el enlace de edición que
// guarda este navegador (lib/tournaments/guest-server.ts).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Info, Loader2, Mail, MailCheck } from "lucide-react";
import {
  GUEST_PATHS,
  TournamentApiProvider,
  type TournamentApi,
} from "@/app/(app)/torneos/tournament-api";
import { loadGuestDb, saveGuestDb } from "@/lib/tournaments/guest/store";
import { AcceptTerms } from "./accept-terms";

export function GuestProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const value = useMemo<TournamentApi>(
    () => ({
      fetch: (input, init) => fetch(input, init),
      refresh: () => router.refresh(),
      guest: true,
      paths: GUEST_PATHS,
    }),
    [router]
  );
  return (
    <TournamentApiProvider value={value}>{children}</TournamentApiProvider>
  );
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

/** Estado del correo: pendiente de confirmar o enlace de inscripción listo. */
export function GuestEmailStatus({
  verified,
  email,
  justConfirmed,
}: {
  verified: boolean;
  email: string;
  justConfirmed: boolean;
}) {
  const t = useTranslations("tournaments.guest");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (justConfirmed) toast.success(t("confirmedToast"));
  }, [justConfirmed, t]);
  if (verified) return null;
  async function resend() {
    setBusy(true);
    await fetch("/api/public/torneos/prueba/reenviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    toast.success(t("resentToast"));
  }
  return (
    <div className="tp-card flex flex-col gap-3 border-amber-500/40 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="flex items-start gap-2">
        <Mail className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <span>{t("pendingEmail", { email })}</span>
      </p>
      <button
        type="button"
        onClick={resend}
        disabled={busy}
        className="inline-flex h-10 shrink-0 items-center gap-2 rounded-full bg-foreground/5 px-4 text-sm font-semibold disabled:opacity-50"
      >
        {busy && <Loader2 className="size-4 animate-spin" />}
        {t("resend")}
      </button>
    </div>
  );
}

/** «¿Has perdido el enlace?»: lo reenvía al correo. */
export function LostLinkForm({ expired }: { expired: boolean }) {
  const t = useTranslations("tournaments.guest");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await fetch("/api/public/torneos/prueba/reenviar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setBusy(false);
    if (res.ok) setSent(true);
    else toast.error(t("resendError"));
  }
  return (
    <form onSubmit={submit} className="tp-card-soft space-y-3 p-4 text-sm">
      {expired && (
        <p className="font-semibold text-red-600">{t("linkExpired")}</p>
      )}
      <p className="font-semibold">{t("lostTitle")}</p>
      {sent ? (
        <p className="flex items-center gap-2 text-foreground/75">
          <MailCheck className="size-4 text-emerald-600" />
          {t("lostSent")}
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
            aria-label={t("email")}
            className="tp-field h-11 min-w-0 flex-1 px-4 text-base"
          />
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[var(--brand-muted)] px-5 text-sm font-bold disabled:opacity-50"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {t("lostButton")}
          </button>
        </div>
      )}
    </form>
  );
}

/**
 * Torneos de la versión anterior del modo prueba (guardados solo en este
 * navegador): se pasan al servidor con un correo, como uno nuevo.
 */
export function LegacyGuestTournaments() {
  const t = useTranslations("tournaments.guest");
  const router = useRouter();
  const [names, setNames] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [accept, setAccept] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    loadGuestDb()
      .then((db) => setNames(db.tournaments.map((x) => x.name)))
      .catch(() => setNames([]));
  }, []);
  if (!names.length) return null;

  async function move(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const db = await loadGuestDb();
    const done = new Set<string>();
    for (const tour of db.tournaments) {
      const entries = db.entries.filter((x) => x.tournamentId === tour.id);
      const res = await fetch("/api/public/torneos/prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          accept,
          legacy: {
            tournament: {
              name: tour.name,
              modality: tour.modality,
              levelCode: tour.levelCode,
              format: tour.format,
              status: tour.status,
              posterTemplate:
                tour.posterTemplate === "image"
                  ? "classic"
                  : tour.posterTemplate,
              timeZone: tour.timeZone,
              maxEntries: tour.maxEntries,
              startDate: tour.startDate,
              endDate: tour.endDate,
              registrationDeadline: tour.registrationDeadline,
              description: tour.description,
              bestOf: tour.bestOf,
              gamesPerSet: tour.gamesPerSet,
              finalSet: tour.finalSet,
            },
            // El servidor ignora los campos que no usa.
            entries,
            matches: db.matches
              .filter((m) => m.tournamentId === tour.id)
              .map((m) => ({ ...m, score: m.score ?? null })),
            news: db.news
              .filter((n) => n.tournamentId === tour.id)
              .map((n) => ({
                title: n.title,
                body: n.body,
                publishedAt: n.publishedAt,
                createdAt: n.createdAt,
              })),
          },
        }),
      });
      if (res.ok) done.add(tour.id);
    }
    await saveGuestDb({
      ...db,
      tournaments: db.tournaments.filter((x) => !done.has(x.id)),
      entries: db.entries.filter((x) => !done.has(x.tournamentId)),
      matches: db.matches.filter((x) => !done.has(x.tournamentId)),
      news: db.news.filter((x) => !done.has(x.tournamentId)),
      photos: db.photos.filter((x) => !done.has(x.tournamentId)),
    });
    setBusy(false);
    setNames((await loadGuestDb()).tournaments.map((x) => x.name));
    if (done.size) toast.success(t("legacyDone", { count: done.size }));
    else toast.error(t("importError"));
    router.refresh();
  }

  return (
    <form onSubmit={move} className="tp-card space-y-3 p-4 text-sm">
      <p className="font-semibold">
        {t("legacyTitle", { count: names.length })}
      </p>
      <p className="text-foreground/70">{t("legacyText")}</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("emailPlaceholder")}
          aria-label={t("email")}
          className="tp-field h-11 min-w-0 flex-1 px-4 text-base"
        />
        <button
          type="submit"
          disabled={busy || !accept}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#d6f04a] px-5 text-sm font-bold text-black disabled:opacity-50"
        >
          {busy && <Loader2 className="size-4 animate-spin" />}
          {t("legacyButton")}
        </button>
      </div>
      <AcceptTerms checked={accept} onChange={setAccept} />
    </form>
  );
}
