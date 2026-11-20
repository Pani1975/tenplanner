// Torneos de prueba (sin cuenta): se guardan solo en el navegador de quien
// los crea (IndexedDB), nunca en el servidor. Ver ./backend.ts.

export type GuestTournament = {
  id: string;
  name: string;
  slug: string;
  sport: "tenis" | "padel" | "pickleball";
  modality: "singles" | "doubles";
  levelCode: string | null;
  format: "knockout" | "round_robin";
  status: string;
  visibility: "public" | "private";
  photosPublic: boolean;
  posterTemplate: "classic" | "court" | "image";
  /** Imagen propia del cartel (data URL JPG). */
  posterImage: string | null;
  archivedAt: string | null;
  timeZone: string;
  maxEntries: number | null;
  startDate: string;
  endDate: string | null;
  registrationDeadline: string | null;
  description: string | null;
  bestOf: number;
  gamesPerSet: number;
  finalSet: string;
  createdAt: string;
  updatedAt: string;
};

export type GuestEntry = {
  id: string;
  tournamentId: string;
  source: "manual";
  status: "pending" | "confirmed" | "waitlist" | "cancelled";
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
  partnerEmail: string | null;
  partnerPhone: string | null;
  partnerIsMinor: boolean;
  partnerGuardianName: string | null;
  partnerGuardianEmail: string | null;
  partnerGuardianPhone: string | null;
  consentAt: string | null;
  consentMethod: string | null;
  consentByName: string | null;
  partnerConsentAt: string | null;
  imageConsentAt: string | null;
  partnerImageConsentAt: string | null;
  seed: number | null;
  createdAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
};

export type GuestMatch = {
  id: string;
  tournamentId: string;
  round: number;
  position: number;
  entryAId: string | null;
  entryBId: string | null;
  status: string;
  winnerEntryId: string | null;
  nextMatchId: string | null;
  nextSlot: string | null;
  score: unknown;
  resultType: string | null;
  courtLabel: string | null;
  scheduledAt: string | null;
};

export type GuestNews = {
  id: string;
  tournamentId: string;
  title: string;
  body: string;
  authorType: "organizer";
  authorName: string;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type GuestPhoto = {
  id: string;
  tournamentId: string;
  /** Data URL de la foto (ya comprimida en el navegador). */
  dataUrl: string;
  caption: string | null;
  published: boolean;
  tags: { entryId: string; side: "player" | "partner" }[];
  createdAt: string;
};

export type GuestDb = {
  v: 1;
  tournaments: GuestTournament[];
  entries: GuestEntry[];
  matches: GuestMatch[];
  news: GuestNews[];
  photos: GuestPhoto[];
};

const DB_NAME = "tenplanner-prueba";
const STORE = "kv";
const KEY = "torneos";
export const GUEST_CHANGED = "tp-guest-torneos-changed";

const empty = (): GuestDb => ({
  v: 1,
  tournaments: [],
  entries: [],
  matches: [],
  news: [],
  photos: [],
});

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function loadGuestDb(): Promise<GuestDb> {
  if (typeof indexedDB === "undefined") return empty();
  const idb = await open();
  return new Promise((resolve, reject) => {
    const req = idb.transaction(STORE).objectStore(STORE).get(KEY);
    req.onsuccess = () => resolve((req.result as GuestDb) ?? empty());
    req.onerror = () => reject(req.error);
  });
}

export async function saveGuestDb(data: GuestDb): Promise<void> {
  const idb = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = idb.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(data, KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  window.dispatchEvent(new Event(GUEST_CHANGED));
}

/** Lee, cambia y guarda en un solo paso (las operaciones son secuenciales). */
let queue: Promise<unknown> = Promise.resolve();
export function updateGuestDb<T>(fn: (db: GuestDb) => T): Promise<T> {
  const run = queue.then(async () => {
    const data = await loadGuestDb();
    const result = fn(data);
    await saveGuestDb(data);
    return result;
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Borra todos los torneos de prueba (tras pasarlos a una cuenta). */
export async function clearGuestDb() {
  await saveGuestDb(empty());
}
