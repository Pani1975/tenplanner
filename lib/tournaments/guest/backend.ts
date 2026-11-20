// API local de los torneos de prueba (sin cuenta). Responde a las mismas
// rutas que /api/tournaments/... con el mismo formato ({ data } o
// { error, detail }), pero lee y escribe en el navegador (./store.ts). Las
// reglas son las de siempre: los módulos puros de lib/tournaments.
//
// No hay alumnos, pistas, calendario, página pública ni circuitos: son de
// la cuenta. El cartel en PDF lo genera el servidor sin guardar nada.

import { z } from "zod";
import {
  applyWinner,
  clearResult,
  generateKnockout,
  orderForDraw,
  type BracketMatch,
} from "../bracket";
import { asPartnerConsent, consentRecord, isConsentComplete } from "../consent";
import {
  allocateNew,
  normalizeEmail,
  normalizePhone,
  promoteFromWaitlist,
  spotsTaken,
  type EntryStatus,
} from "../entries";
import { imageConsentStatus } from "../image-consent";
import { generateRoundRobin } from "../round-robin";
import {
  createTournamentSchema,
  matchResultSchema,
  updateEntrySchema,
  updateTournamentSchema,
} from "../schemas";
import { evaluateResult } from "../score";
import { tournamentSlug } from "../slug";
import {
  canEditEntries,
  canTransition,
  effectiveStatus,
  type TournamentStatus,
} from "../status";
import { timelineTab, todayInMadrid } from "../timeline";
import {
  loadGuestDb,
  updateGuestDb,
  type GuestDb,
  type GuestEntry,
  type GuestMatch,
  type GuestTournament,
} from "./store";

const ROUND_ROBIN_MAX = 16;
/** Quien organiza en modo prueba (para el consentimiento declarado). */
const GUEST_USER = "prueba";

class GuestError extends Error {
  constructor(
    public code: string,
    public status: number,
    public detail?: unknown
  ) {
    super(code);
  }
}

const ok = (data: unknown, status = 200) =>
  new Response(JSON.stringify({ data }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
const fail = (e: GuestError) =>
  new Response(JSON.stringify({ error: e.code, detail: e.detail ?? null }), {
    status: e.status,
    headers: { "Content-Type": "application/json" },
  });

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

function find(db: GuestDb, id: string): GuestTournament {
  const t = db.tournaments.find((x) => x.id === id);
  if (!t) throw new GuestError("not_found", 404);
  return t;
}
const statusIn = (t: GuestTournament) => ({
  status: t.status as TournamentStatus,
  registrationDeadline: t.registrationDeadline,
});
export const guestStatusOf = (t: GuestTournament) =>
  effectiveStatus(statusIn(t));

function parse<S extends z.ZodTypeAny>(schema: S, body: unknown): z.output<S> {
  const r = schema.safeParse(body);
  if (!r.success) throw new GuestError("invalid_input", 400, r.error.issues);
  return r.data;
}

// En modo prueba los contactos son opcionales (es solo para probar).
const person = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().min(1).max(160),
  email: z.string().trim().max(255).optional().nullable(),
  phone: z.string().trim().max(32).optional().nullable(),
  isMinor: z.boolean().default(false),
  guardianName: z.string().trim().max(120).optional().nullable(),
  guardianEmail: z.string().trim().max(255).optional().nullable(),
  guardianPhone: z.string().trim().max(32).optional().nullable(),
});
const manualEntrySchema = z.object({
  kind: z.literal("manual"),
  player: person,
  partner: person.optional().nullable(),
  levelCode: z.string().max(32).optional().nullable(),
  consentDeclared: z.boolean(),
  imageConsent: z.boolean().optional(),
});

// ── Torneos ────────────────────────────────────────────────────────────

function createTournament(db: GuestDb, body: unknown) {
  const input = parse(createTournamentSchema, body);
  if (input.circuitId || input.newCircuit) {
    throw new GuestError("guest_not_available", 403);
  }
  const ts = now();
  const t: GuestTournament = {
    id: uid(),
    name: input.name,
    slug: tournamentSlug(input.name),
    sport: "tenis",
    modality: input.modality,
    levelCode: input.levelCode ?? null,
    format: input.format,
    status: "draft",
    visibility: "public",
    photosPublic: false,
    posterTemplate: input.posterTemplate ?? "classic",
    posterImage: null,
    archivedAt: null,
    timeZone: input.timeZone ?? "Europe/Madrid",
    maxEntries: input.maxEntries ?? null,
    startDate: input.startDate,
    endDate: input.endDate ?? null,
    registrationDeadline: input.registrationDeadline ?? null,
    description: input.description ?? null,
    bestOf: input.bestOf,
    gamesPerSet: input.gamesPerSet,
    finalSet: input.finalSet,
    createdAt: ts,
    updatedAt: ts,
  };
  db.tournaments.push(t);
  return t;
}

function applyPromotions(
  db: GuestDb,
  promoted: { id: string; status: "confirmed" | "pending" }[]
) {
  for (const p of promoted) {
    const e = db.entries.find((x) => x.id === p.id);
    if (!e) continue;
    e.status = p.status;
    if (p.status === "confirmed") e.confirmedAt = now();
  }
}

const queueOf = (entries: GuestEntry[]) =>
  entries.map((e) => ({
    id: e.id,
    status: e.status as EntryStatus,
    createdAt: e.createdAt,
    hasConsent: isConsentComplete(e),
  }));

function updateTournament(db: GuestDb, id: string, body: unknown) {
  const input = parse(updateTournamentSchema, body);
  const t = find(db, id);
  const entries = db.entries.filter((e) => e.tournamentId === id);
  const matches = db.matches.filter((m) => m.tournamentId === id);
  const hasEntries = entries.some((e) => e.status !== "cancelled");
  const hasDraw = matches.length > 0;
  if (input.circuitId || input.newCircuit) {
    throw new GuestError("guest_not_available", 403);
  }
  if (input.modality && input.modality !== t.modality && hasEntries) {
    throw new GuestError("modality_locked", 409);
  }
  if (input.format && input.format !== t.format && hasDraw) {
    throw new GuestError("format_locked", 409);
  }
  const scoringChange =
    (input.bestOf !== undefined && input.bestOf !== t.bestOf) ||
    (input.gamesPerSet !== undefined && input.gamesPerSet !== t.gamesPerSet) ||
    (input.finalSet !== undefined && input.finalSet !== t.finalSet);
  if (scoringChange && matches.some((m) => m.status === "played")) {
    throw new GuestError("scoring_locked", 409);
  }
  const startDate = input.startDate ?? t.startDate;
  const endDate = input.endDate !== undefined ? input.endDate : t.endDate;
  const deadline =
    input.registrationDeadline !== undefined
      ? input.registrationDeadline
      : t.registrationDeadline;
  if (endDate && endDate < startDate) {
    throw new GuestError("invalid_dates", 400);
  }
  const maxEntries =
    input.maxEntries !== undefined ? input.maxEntries : t.maxEntries;
  const typed = entries.map((e) => ({ ...e, status: e.status as EntryStatus }));
  if (maxEntries != null && spotsTaken(typed) > maxEntries) {
    throw new GuestError("max_below_taken", 409, { taken: spotsTaken(typed) });
  }
  const previousStatus = t.status;
  if (input.status && input.status !== t.status) {
    if (input.status === "in_progress" && !hasDraw) {
      throw new GuestError("draw_required", 409);
    }
    const okMove = canTransition(
      { status: t.status as TournamentStatus, registrationDeadline: deadline },
      input.status
    );
    if (!okMove) throw new GuestError("invalid_transition", 409);
  }
  Object.assign(t, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.modality !== undefined && { modality: input.modality }),
    ...(input.levelCode !== undefined && { levelCode: input.levelCode }),
    ...(input.format !== undefined && { format: input.format }),
    ...(input.maxEntries !== undefined && { maxEntries }),
    ...(input.startDate !== undefined && { startDate }),
    ...(input.endDate !== undefined && { endDate }),
    ...(input.registrationDeadline !== undefined && {
      registrationDeadline: deadline,
    }),
    ...(input.timeZone !== undefined && { timeZone: input.timeZone }),
    ...(input.photosPublic !== undefined && {
      photosPublic: input.photosPublic,
    }),
    ...(input.posterTemplate !== undefined && {
      posterTemplate: input.posterTemplate,
    }),
    ...(input.bestOf !== undefined && { bestOf: input.bestOf }),
    ...(input.gamesPerSet !== undefined && { gamesPerSet: input.gamesPerSet }),
    ...(input.finalSet !== undefined && { finalSet: input.finalSet }),
    ...(input.status !== undefined && { status: input.status }),
    updatedAt: now(),
  });
  let promoted: { id: string; status: "confirmed" | "pending" }[] = [];
  if (!hasDraw) {
    promoted = promoteFromWaitlist(queueOf(entries), maxEntries);
    applyPromotions(db, promoted);
  }
  return { tournament: t, promoted, previousStatus, sessionsCancelled: null };
}

function setArchived(db: GuestDb, id: string, body: unknown) {
  const { archived } = parse(z.object({ archived: z.boolean() }), body);
  const t = find(db, id);
  if (
    archived &&
    timelineTab(
      {
        status: guestStatusOf(t),
        startDate: t.startDate,
        endDate: t.endDate,
      },
      todayInMadrid()
    ) !== "past"
  ) {
    throw new GuestError("not_past", 409);
  }
  t.archivedAt = archived ? now() : null;
  return { ok: true };
}

// ── Inscripciones ──────────────────────────────────────────────────────

function addEntry(db: GuestDb, id: string, body: unknown) {
  if ((body as { kind?: string })?.kind === "school") {
    throw new GuestError("guest_no_students", 403);
  }
  const input = parse(manualEntrySchema, body);
  const t = find(db, id);
  if (!canEditEntries(statusIn(t))) {
    throw new GuestError("entries_locked", 409);
  }
  const doubles = t.modality === "doubles";
  if (doubles && !input.partner) throw new GuestError("partner_required", 400);
  if (!doubles && input.partner) {
    throw new GuestError("partner_not_allowed", 400);
  }
  const p = input.player;
  const q = input.partner ?? null;
  const contact = (x: typeof p) => ({
    email: x.isMinor ? null : normalizeEmail(x.email),
    phone: x.isMinor ? null : normalizePhone(x.phone),
    guardianName: x.isMinor ? (x.guardianName ?? null) : null,
    guardianEmail: x.isMinor ? normalizeEmail(x.guardianEmail) : null,
    guardianPhone: x.isMinor ? normalizePhone(x.guardianPhone) : null,
  });
  const pc = contact(p);
  const qc = q ? contact(q) : null;
  const existing = db.entries
    .filter((e) => e.tournamentId === id)
    .map((e) => ({ ...e, status: e.status as EntryStatus }));
  const [status] = allocateNew(existing, t.maxEntries, [
    { hasConsent: input.consentDeclared },
  ]);
  const record = input.consentDeclared
    ? consentRecord({
        method: "coach_declared",
        byUserId: GUEST_USER,
        byName: `${p.firstName} ${p.lastName}`,
      })
    : null;
  const consent = record?.ok ? record.record : null;
  const ts = now();
  const entry: GuestEntry = {
    id: uid(),
    tournamentId: id,
    source: "manual",
    status,
    firstName: p.firstName,
    lastName: p.lastName,
    ...pc,
    isMinor: p.isMinor,
    levelCode: input.levelCode ?? null,
    partnerFirstName: q?.firstName ?? null,
    partnerLastName: q?.lastName ?? null,
    partnerEmail: qc?.email ?? null,
    partnerPhone: qc?.phone ?? null,
    partnerIsMinor: q?.isMinor ?? false,
    partnerGuardianName: qc?.guardianName ?? null,
    partnerGuardianEmail: qc?.guardianEmail ?? null,
    partnerGuardianPhone: qc?.guardianPhone ?? null,
    consentAt: consent ? consent.consentAt.toISOString() : null,
    consentMethod: consent ? consent.consentMethod : null,
    consentByName: consent ? consent.consentByName : null,
    partnerConsentAt:
      consent && q ? asPartnerConsent(consent).partnerConsentAt.toISOString() : null,
    imageConsentAt: input.imageConsent ? ts : null,
    partnerImageConsentAt: input.imageConsent && q ? ts : null,
    seed: null,
    createdAt: ts,
    confirmedAt: status === "confirmed" ? ts : null,
    cancelledAt: null,
  };
  db.entries.push(entry);
  return { entry };
}

function updateEntry(db: GuestDb, id: string, entryId: string, body: unknown) {
  const action = parse(updateEntrySchema, body);
  const t = find(db, id);
  const all = db.entries.filter((e) => e.tournamentId === id);
  const entry = all.find((e) => e.id === entryId);
  if (!entry) throw new GuestError("not_found", 404);
  if (action.action === "seed") {
    if (db.matches.some((m) => m.tournamentId === id)) {
      throw new GuestError("draw_exists", 409);
    }
    entry.seed = action.seed;
    return { promoted: [] };
  }
  if (action.action === "declare_consent") {
    if (entry.status === "cancelled") {
      throw new GuestError("entry_cancelled", 409);
    }
    const ts = now();
    entry.consentAt = ts;
    entry.consentMethod = "coach_declared";
    entry.consentByName = [entry.firstName, entry.lastName]
      .filter(Boolean)
      .join(" ");
    if (entry.partnerFirstName) entry.partnerConsentAt = ts;
    if (entry.status === "pending") {
      entry.status = "confirmed";
      entry.confirmedAt = ts;
    }
    return { promoted: [] };
  }
  if (!canEditEntries(statusIn(t))) {
    throw new GuestError("entries_locked", 409);
  }
  if (entry.status === "cancelled") return { promoted: [] };
  entry.status = "cancelled";
  entry.cancelledAt = now();
  const promoted = promoteFromWaitlist(queueOf(all), t.maxEntries);
  applyPromotions(db, promoted);
  return { promoted };
}

// ── Cuadro y resultados ────────────────────────────────────────────────

const toBracket = (rows: GuestMatch[]): BracketMatch[] =>
  rows.map((m) => ({
    key: m.id,
    round: m.round,
    position: m.position,
    entryA: m.entryAId,
    entryB: m.entryBId,
    status: m.status as BracketMatch["status"],
    winner: m.winnerEntryId,
    nextKey: m.nextMatchId,
    nextSlot: (m.nextSlot as "a" | "b" | null) ?? null,
  }));

function persistBracket(rows: GuestMatch[], after: BracketMatch[]) {
  const byId = new Map(rows.map((m) => [m.id, m]));
  for (const m of after) {
    const row = byId.get(m.key);
    if (!row) continue;
    row.entryAId = m.entryA;
    row.entryBId = m.entryB;
  }
}

function generateDraw(db: GuestDb, id: string, body: unknown) {
  const { excludePending } = parse(
    z.object({ excludePending: z.boolean().default(false) }),
    body ?? {}
  );
  const t = find(db, id);
  const current = guestStatusOf(t);
  if (current !== "closed" && current !== "in_progress") {
    throw new GuestError("must_be_closed", 409);
  }
  const entries = db.entries
    .filter((e) => e.tournamentId === id)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const pending = entries.filter((e) => e.status === "pending");
  if (pending.length && !excludePending) {
    throw new GuestError("pending_consent", 409, { count: pending.length });
  }
  const confirmed = entries
    .filter((e) => e.status === "confirmed")
    .map((e) => ({ id: e.id, seed: e.seed }));
  if (confirmed.length < 2) throw new GuestError("not_enough_entries", 409);
  if (t.format === "round_robin" && confirmed.length > ROUND_ROBIN_MAX) {
    throw new GuestError("too_many_for_round_robin", 409, {
      max: ROUND_ROBIN_MAX,
    });
  }
  const old = db.matches.filter((m) => m.tournamentId === id);
  if (old.some((m) => m.status === "played")) {
    throw new GuestError("results_exist", 409);
  }
  db.matches = db.matches.filter((m) => m.tournamentId !== id);
  const base = {
    tournamentId: id,
    score: null,
    resultType: null,
    courtLabel: null,
    scheduledAt: null,
  };
  if (t.format === "knockout") {
    const bracket = generateKnockout(orderForDraw(confirmed));
    const ids = new Map(bracket.map((m) => [m.key, uid()]));
    for (const m of bracket) {
      db.matches.push({
        ...base,
        id: ids.get(m.key)!,
        round: m.round,
        position: m.position,
        entryAId: m.entryA,
        entryBId: m.entryB,
        status: m.status,
        winnerEntryId: m.winner,
        nextMatchId: m.nextKey ? ids.get(m.nextKey)! : null,
        nextSlot: m.nextSlot,
      });
    }
  } else {
    for (const p of generateRoundRobin(confirmed.map((e) => e.id))) {
      db.matches.push({
        ...base,
        id: uid(),
        round: p.round,
        position: p.position,
        entryAId: p.entryA,
        entryBId: p.entryB,
        status: "pending",
        winnerEntryId: null,
        nextMatchId: null,
        nextSlot: null,
      });
    }
  }
  t.status = "in_progress";
  return matchesOf(db, id);
}

const matchesOf = (db: GuestDb, id: string) =>
  db.matches
    .filter((m) => m.tournamentId === id)
    .sort((a, b) => a.round - b.round || a.position - b.position);

function recordResult(db: GuestDb, id: string, matchId: string, body: unknown) {
  const input = parse(matchResultSchema, body);
  const t = find(db, id);
  if (guestStatusOf(t) !== "in_progress") {
    throw new GuestError("not_in_progress", 409);
  }
  const rows = matchesOf(db, id);
  const match = rows.find((m) => m.id === matchId);
  if (!match) throw new GuestError("not_found", 404);
  if (match.status === "bye") throw new GuestError("bye_match", 409);
  if (!match.entryAId || !match.entryBId) {
    throw new GuestError("missing_opponent", 409);
  }
  const result = evaluateResult(
    { resultType: input.resultType, score: input.score, winner: input.winner },
    {
      bestOf: t.bestOf as 1 | 3 | 5,
      gamesPerSet: t.gamesPerSet,
      finalSet: t.finalSet as "full" | "super_tiebreak",
    }
  );
  if (!result.ok) throw new GuestError(result.error, 400);
  const winnerId = result.winner === "a" ? match.entryAId : match.entryBId;
  if (t.format === "knockout") {
    const applied = applyWinner(toBracket(rows), matchId, winnerId);
    if (!applied.ok) throw new GuestError(applied.error, 409);
    persistBracket(rows, applied.matches);
  }
  Object.assign(match, {
    status: "played",
    resultType: result.resultType,
    score: result.score,
    winnerEntryId: winnerId,
    ...(input.scheduledAt !== undefined && { scheduledAt: input.scheduledAt }),
    ...(input.courtLabel !== undefined && { courtLabel: input.courtLabel }),
  });
  return match;
}

function clearMatch(db: GuestDb, id: string, matchId: string) {
  const t = find(db, id);
  if (guestStatusOf(t) !== "in_progress") {
    throw new GuestError("not_in_progress", 409);
  }
  const rows = matchesOf(db, id);
  const match = rows.find((m) => m.id === matchId);
  if (!match) throw new GuestError("not_found", 404);
  if (match.status === "bye") throw new GuestError("bye_match", 409);
  if (t.format === "knockout") {
    const cleared = clearResult(toBracket(rows), matchId);
    if (!cleared.ok) throw new GuestError(cleared.error, 409);
    persistBracket(rows, cleared.matches);
  }
  Object.assign(match, {
    status: "pending",
    resultType: null,
    score: null,
    winnerEntryId: null,
  });
  return { ok: true };
}

// ── Noticias y fotos ───────────────────────────────────────────────────

const newsSchema = z.object({
  title: z.string().trim().min(1).max(160),
  body: z.string().trim().min(1).max(5000),
  publish: z.boolean().default(false),
});
const newsUpdateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  body: z.string().trim().min(1).max(5000).optional(),
  published: z.boolean().optional(),
});
const photoUpdateSchema = z.object({
  caption: z.string().trim().max(200).nullable().optional(),
  tags: z
    .array(
      z.object({
        entryId: z.string(),
        side: z.enum(["player", "partner"]),
      })
    )
    .max(40)
    .optional(),
  published: z.boolean().optional(),
  acknowledged: z.boolean().optional(),
});

function people(db: GuestDb, id: string) {
  const full = (f: string | null, l: string | null) =>
    [f, l].filter(Boolean).join(" ");
  return db.entries
    .filter((e) => e.tournamentId === id && e.status !== "cancelled")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .flatMap((e) => [
      {
        entryId: e.id,
        side: "player" as const,
        name: full(e.firstName, e.lastName),
        image: imageConsentStatus({
          isStudent: false,
          entryConsentAt: e.imageConsentAt,
        }),
      },
      ...(e.partnerFirstName
        ? [
            {
              entryId: e.id,
              side: "partner" as const,
              name: full(e.partnerFirstName, e.partnerLastName),
              image: imageConsentStatus({
                isStudent: false,
                entryConsentAt: e.partnerImageConsentAt,
              }),
            },
          ]
        : []),
    ]);
}

function listPhotos(db: GuestDb, id: string) {
  find(db, id);
  const ppl = people(db, id);
  const key = (entryId: string, side: string) => `${entryId}:${side}`;
  const byKey = new Map(ppl.map((p) => [key(p.entryId, p.side), p]));
  return {
    people: ppl,
    photos: db.photos
      .filter((p) => p.tournamentId === id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => ({
        id: p.id,
        url: p.dataUrl,
        caption: p.caption,
        published: p.published,
        tags: p.tags
          .map((t) => byKey.get(key(t.entryId, t.side)))
          .filter((x): x is (typeof ppl)[number] => !!x),
      })),
  };
}

function updatePhoto(db: GuestDb, id: string, photoId: string, body: unknown) {
  const input = parse(photoUpdateSchema, body);
  const photo = db.photos.find(
    (p) => p.id === photoId && p.tournamentId === id
  );
  if (!photo) throw new GuestError("not_found", 404);
  const ppl = people(db, id);
  const key = (entryId: string, side: string) => `${entryId}:${side}`;
  const byKey = new Map(ppl.map((p) => [key(p.entryId, p.side), p]));
  if (input.tags) {
    if (input.tags.some((t) => !byKey.has(key(t.entryId, t.side)))) {
      throw new GuestError("invalid_tags", 400);
    }
    photo.tags = input.tags;
  }
  if (input.published && !input.acknowledged) {
    const missing = photo.tags
      .map((t) => byKey.get(key(t.entryId, t.side)))
      .filter((p): p is (typeof ppl)[number] => !!p && p.image !== "yes");
    if (missing.length) {
      throw new GuestError("image_consent_missing", 409, {
        people: missing.map((p) => ({ name: p.name, image: p.image })),
      });
    }
  }
  if (input.caption !== undefined) photo.caption = input.caption || null;
  if (input.published !== undefined) photo.published = input.published;
  return { ok: true };
}

const fileToDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

// ── Cartel ─────────────────────────────────────────────────────────────

/** Cartel en PDF: lo genera el servidor con los datos enviados, sin guardar. */
async function posterPdf(id: string, inline: boolean): Promise<Response> {
  const db = await loadGuestDb();
  const t = find(db, id);
  return fetch(
    `/api/public/torneos/prueba-cartel${inline ? "?inline=1" : ""}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: t.name,
        sport: t.sport,
        modality: t.modality,
        format: t.format,
        levelCode: t.levelCode,
        startDate: t.startDate,
        endDate: t.endDate,
        registrationDeadline: t.registrationDeadline,
        maxEntries: t.maxEntries,
        description: t.description,
        timeZone: t.timeZone,
        template: t.posterTemplate,
        image: t.posterTemplate === "image" ? t.posterImage : null,
      }),
    }
  );
}

// ── Enrutado ───────────────────────────────────────────────────────────

async function readBody(init?: RequestInit): Promise<unknown> {
  if (!init?.body || typeof init.body !== "string") return undefined;
  try {
    return JSON.parse(init.body);
  } catch {
    throw new GuestError("invalid_json", 400);
  }
}

/**
 * fetch() de los torneos de prueba: mismas rutas que /api/tournaments.
 */
export async function guestFetch(
  input: string,
  init?: RequestInit
): Promise<Response> {
  const url = new URL(input, "http://local");
  const method = (init?.method ?? "GET").toUpperCase();
  const parts = url.pathname.replace(/^\/api\/tournaments\/?/, "").split("/");
  const [id, sub, subId] = parts.filter(Boolean);
  try {
    if (!id) {
      if (method === "POST") {
        const body = await readBody(init);
        return ok(await updateGuestDb((db) => createTournament(db, body)), 201);
      }
      const db = await loadGuestDb();
      return ok(db.tournaments);
    }
    if (id === "court-conflicts") return ok({ sessions: [], bookings: [] });
    if (id === "circuits") return ok([]);

    if (!sub) {
      if (method === "PATCH") {
        const body = await readBody(init);
        return ok(await updateGuestDb((db) => updateTournament(db, id, body)));
      }
      if (method === "DELETE") {
        await updateGuestDb((db) => {
          find(db, id);
          db.tournaments = db.tournaments.filter((t) => t.id !== id);
          db.entries = db.entries.filter((e) => e.tournamentId !== id);
          db.matches = db.matches.filter((m) => m.tournamentId !== id);
          db.news = db.news.filter((n) => n.tournamentId !== id);
          db.photos = db.photos.filter((p) => p.tournamentId !== id);
        });
        return ok({ ok: true });
      }
      return ok(find(await loadGuestDb(), id));
    }

    switch (sub) {
      case "archive": {
        const body = await readBody(init);
        return ok(await updateGuestDb((db) => setArchived(db, id, body)));
      }
      case "entries": {
        const body = await readBody(init);
        if (subId) {
          return ok(
            await updateGuestDb((db) => updateEntry(db, id, subId, body))
          );
        }
        return ok(await updateGuestDb((db) => addEntry(db, id, body)), 201);
      }
      case "draw": {
        const body = await readBody(init);
        return ok(await updateGuestDb((db) => generateDraw(db, id, body)), 201);
      }
      case "matches": {
        if (!subId) break;
        if (method === "DELETE") {
          return ok(await updateGuestDb((db) => clearMatch(db, id, subId)));
        }
        const body = await readBody(init);
        return ok(
          await updateGuestDb((db) => recordResult(db, id, subId, body))
        );
      }
      case "news": {
        if (!subId) {
          if (method === "POST") {
            const input = parse(newsSchema, await readBody(init));
            return ok(
              await updateGuestDb((db) => {
                find(db, id);
                const ts = now();
                const row = {
                  id: uid(),
                  tournamentId: id,
                  title: input.title,
                  body: input.body,
                  authorType: "organizer" as const,
                  authorName: "Organización",
                  publishedAt: input.publish ? ts : null,
                  createdAt: ts,
                  updatedAt: ts,
                };
                db.news.push(row);
                return row;
              }),
              201
            );
          }
          const db = await loadGuestDb();
          find(db, id);
          return ok(
            db.news
              .filter((n) => n.tournamentId === id)
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
          );
        }
        if (method === "DELETE") {
          await updateGuestDb((db) => {
            db.news = db.news.filter(
              (n) => !(n.id === subId && n.tournamentId === id)
            );
          });
          return ok({ ok: true });
        }
        const input = parse(newsUpdateSchema, await readBody(init));
        return ok(
          await updateGuestDb((db) => {
            const n = db.news.find(
              (x) => x.id === subId && x.tournamentId === id
            );
            if (!n) throw new GuestError("not_found", 404);
            if (input.title !== undefined) n.title = input.title;
            if (input.body !== undefined) n.body = input.body;
            if (input.published !== undefined) {
              n.publishedAt = input.published ? (n.publishedAt ?? now()) : null;
            }
            n.updatedAt = now();
            return n;
          })
        );
      }
      case "photos": {
        if (!subId) {
          if (method === "POST") {
            const form = init?.body;
            const file = form instanceof FormData ? form.get("file") : null;
            if (!(file instanceof Blob)) {
              throw new GuestError("invalid_input", 400);
            }
            if (file.size > MAX_IMAGE_BYTES) {
              throw new GuestError("photo_too_big", 400);
            }
            const dataUrl = await fileToDataUrl(file);
            const caption =
              String((form as FormData).get("caption") ?? "")
                .trim()
                .slice(0, 200) || null;
            return ok(
              await updateGuestDb((db) => {
                find(db, id);
                const row = {
                  id: uid(),
                  tournamentId: id,
                  dataUrl,
                  caption,
                  published: false,
                  tags: [],
                  createdAt: now(),
                };
                db.photos.push(row);
                return { id: row.id };
              }),
              201
            );
          }
          return ok(listPhotos(await loadGuestDb(), id));
        }
        if (method === "DELETE") {
          await updateGuestDb((db) => {
            db.photos = db.photos.filter(
              (p) => !(p.id === subId && p.tournamentId === id)
            );
          });
          return ok({ ok: true });
        }
        const body = await readBody(init);
        return ok(
          await updateGuestDb((db) => updatePhoto(db, id, subId, body))
        );
      }
      case "poster-image": {
        if (method === "POST") {
          const form = init?.body;
          const file = form instanceof FormData ? form.get("file") : null;
          if (!(file instanceof Blob)) {
            throw new GuestError("invalid_input", 400);
          }
          if (file.size > MAX_IMAGE_BYTES) {
            throw new GuestError("photo_too_big", 400);
          }
          const dataUrl = await fileToDataUrl(file);
          await updateGuestDb((db) => {
            const t = find(db, id);
            t.posterImage = dataUrl;
            t.posterTemplate = "image";
          });
          return ok({ url: dataUrl }, 201);
        }
        if (method === "DELETE") {
          await updateGuestDb((db) => {
            const t = find(db, id);
            t.posterImage = null;
            if (t.posterTemplate === "image") t.posterTemplate = "classic";
          });
          return ok({ ok: true });
        }
        const t = find(await loadGuestDb(), id);
        return ok({ url: t.posterImage });
      }
      case "poster":
        return posterPdf(id, url.searchParams.get("inline") === "1");
      case "candidates":
        throw new GuestError("guest_no_students", 403);
      case "schedule":
        throw new GuestError("guest_not_available", 403);
    }
    throw new GuestError("not_found", 404);
  } catch (e) {
    if (e instanceof GuestError) return fail(e);
    console.error("[torneos de prueba]", e);
    return fail(new GuestError("generic", 500));
  }
}
