"use client";

// Al entrar con cuenta en el mismo navegador donde se probaron los torneos
// sin registro: ofrece pasarlos a la cuenta (o descartarlos).

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2, Upload } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  loadGuestDb,
  saveGuestDb,
  type GuestDb,
  type GuestTournament,
} from "@/lib/tournaments/guest/store";

/** data URL a Blob sin fetch (la CSP no deja conectar con data:). */
function dataUrlToBlob(url: string): Blob {
  const [head, b64] = url.split(",");
  const type = /data:([^;]+)/.exec(head)?.[1] ?? "application/octet-stream";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type });
}

async function importOne(db: GuestDb, t: GuestTournament) {
  const entries = db.entries.filter((e) => e.tournamentId === t.id);
  const res = await fetch("/api/tournaments/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tournament: {
        name: t.name,
        modality: t.modality,
        levelCode: t.levelCode,
        format: t.format,
        status: t.status,
        posterTemplate: t.posterTemplate,
        timeZone: t.timeZone,
        maxEntries: t.maxEntries,
        startDate: t.startDate,
        endDate: t.endDate,
        registrationDeadline: t.registrationDeadline,
        description: t.description,
        bestOf: t.bestOf,
        gamesPerSet: t.gamesPerSet,
        finalSet: t.finalSet,
      },
      entries: entries.map((e) => ({
        id: e.id,
        status: e.status,
        firstName: e.firstName,
        lastName: e.lastName,
        email: e.email,
        phone: e.phone,
        isMinor: e.isMinor,
        guardianName: e.guardianName,
        guardianEmail: e.guardianEmail,
        guardianPhone: e.guardianPhone,
        levelCode: e.levelCode,
        partnerFirstName: e.partnerFirstName,
        partnerLastName: e.partnerLastName,
        partnerEmail: e.partnerEmail,
        partnerPhone: e.partnerPhone,
        partnerIsMinor: e.partnerIsMinor,
        partnerGuardianName: e.partnerGuardianName,
        partnerGuardianEmail: e.partnerGuardianEmail,
        partnerGuardianPhone: e.partnerGuardianPhone,
        consentAt: e.consentAt,
        partnerConsentAt: e.partnerConsentAt,
        imageConsentAt: e.imageConsentAt,
        partnerImageConsentAt: e.partnerImageConsentAt,
        seed: e.seed,
        createdAt: e.createdAt,
        confirmedAt: e.confirmedAt,
        cancelledAt: e.cancelledAt,
      })),
      matches: db.matches
        .filter((m) => m.tournamentId === t.id)
        .map((m) => ({
          id: m.id,
          round: m.round,
          position: m.position,
          entryAId: m.entryAId,
          entryBId: m.entryBId,
          status: m.status,
          winnerEntryId: m.winnerEntryId,
          nextMatchId: m.nextMatchId,
          nextSlot: m.nextSlot,
          score: m.score ?? null,
          resultType: m.resultType,
          courtLabel: m.courtLabel,
        })),
      news: db.news
        .filter((n) => n.tournamentId === t.id)
        .map((n) => ({
          title: n.title,
          body: n.body,
          publishedAt: n.publishedAt,
          createdAt: n.createdAt,
        })),
    }),
  });
  if (!res.ok) throw new Error("import");
  const { data } = (await res.json()) as {
    data: { id: string; entryIds: Record<string, string> };
  };
  const base = `/api/tournaments/${data.id}`;

  // Fotos: se suben como siempre y se les ponen pie y etiquetas. Quedan
  // sin publicar (el torneo pasa a la cuenta como privado). El torneo ya
  // está creado: si falla una foto se sigue (no se duplica al reintentar).
  for (const p of db.photos.filter((x) => x.tournamentId === t.id)) {
    try {
      const form = new FormData();
      const blob = dataUrlToBlob(p.dataUrl);
      form.append("file", new File([blob], "foto", { type: blob.type }));
      if (p.caption) form.append("caption", p.caption);
      const up = await fetch(`${base}/photos`, { method: "POST", body: form });
      if (!up.ok) continue;
      const { data: photo } = (await up.json()) as { data: { id: string } };
      const tags = p.tags
        .map((tag) => ({ ...tag, entryId: data.entryIds[tag.entryId] }))
        .filter((tag) => !!tag.entryId);
      if (tags.length) {
        await fetch(`${base}/photos/${photo.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags }),
        });
      }
    } catch (e) {
      console.error("[torneos de prueba] foto", e);
    }
  }
  // Imagen propia del cartel.
  if (t.posterImage) {
    try {
      const blob = dataUrlToBlob(t.posterImage);
      const form = new FormData();
      form.append("file", new File([blob], "cartel.jpg", { type: blob.type }));
      await fetch(`${base}/poster-image`, { method: "POST", body: form });
    } catch (e) {
      console.error("[torneos de prueba] cartel", e);
    }
  }
}

/** Quita del navegador los torneos ya pasados (o todos al descartar). */
async function removeFromGuest(ids: Set<string>) {
  const db = await loadGuestDb();
  await saveGuestDb({
    ...db,
    tournaments: db.tournaments.filter((t) => !ids.has(t.id)),
    entries: db.entries.filter((e) => !ids.has(e.tournamentId)),
    matches: db.matches.filter((m) => !ids.has(m.tournamentId)),
    news: db.news.filter((n) => !ids.has(n.tournamentId)),
    photos: db.photos.filter((p) => !ids.has(p.tournamentId)),
  });
}

export function GuestImportCard() {
  const t = useTranslations("tournaments.guest");
  const router = useRouter();
  const [db, setDb] = useState<GuestDb | null>(null);
  const [busy, setBusy] = useState(false);
  const [discard, setDiscard] = useState(false);

  useEffect(() => {
    loadGuestDb()
      .then(setDb)
      .catch(() => setDb(null));
  }, []);

  if (!db || db.tournaments.length === 0) return null;
  const count = db.tournaments.length;

  async function run() {
    if (!db) return;
    setBusy(true);
    const done = new Set<string>();
    let failed = false;
    for (const tour of db.tournaments) {
      try {
        await importOne(db, tour);
        done.add(tour.id);
      } catch {
        failed = true;
      }
    }
    await removeFromGuest(done);
    setDb(await loadGuestDb());
    setBusy(false);
    if (done.size) toast.success(t("importDone", { count: done.size }));
    if (failed) toast.error(t("importError"));
    router.refresh();
  }

  return (
    <div className="tp-card-soft flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-bold">{t("importTitle", { count })}</p>
        <p className="text-sm text-foreground/70">{t("importText")}</p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={() => setDiscard(true)}
          disabled={busy}
          className="h-11 rounded-full px-4 text-sm font-semibold disabled:opacity-50"
        >
          {t("importDiscard")}
        </button>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#d6f04a] px-5 text-sm font-bold text-black disabled:opacity-50"
        >
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Upload className="size-4" />
          )}
          {t("importButton")}
        </button>
      </div>
      <ConfirmDialog
        open={discard}
        onOpenChange={setDiscard}
        title={t("importDiscardTitle")}
        description={t("importDiscardText")}
        confirmLabel={t("importDiscard")}
        destructive
        onConfirm={async () => {
          await removeFromGuest(new Set(db.tournaments.map((x) => x.id)));
          setDb(await loadGuestDb());
          setDiscard(false);
        }}
      />
    </div>
  );
}
