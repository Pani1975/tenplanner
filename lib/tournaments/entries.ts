// Inscripciones: reparto entre plazas y lista de espera, subida desde la
// lista de espera y detección de duplicados. Funciones puras.

import { isAdult } from "@/lib/age";

export type EntryStatus = "pending" | "confirmed" | "waitlist" | "cancelled";

/**
 * Ocupan plaza las confirmadas y las pendientes (alumno a la espera de
 * consentimiento): así no se pierde su sitio mientras llega.
 */
export const takesSpot = (s: EntryStatus) =>
  s === "confirmed" || s === "pending";

export function spotsTaken(entries: { status: EntryStatus }[]): number {
  return entries.filter((e) => takesSpot(e.status)).length;
}

/**
 * Estado de cada nueva inscripción, en el orden dado. `hasConsent` decide
 * entre confirmada y pendiente cuando hay plaza; sin plaza, lista de espera.
 * maxEntries null = sin límite.
 */
export function allocateNew(
  existing: { status: EntryStatus }[],
  maxEntries: number | null,
  candidates: { hasConsent: boolean }[]
): EntryStatus[] {
  let free =
    maxEntries == null
      ? Infinity
      : Math.max(0, maxEntries - spotsTaken(existing));
  // Si ya hay lista de espera, nadie se la salta.
  const queue = existing.some((e) => e.status === "waitlist");
  return candidates.map((c) => {
    if (free > 0 && !queue) {
      free -= 1;
      return c.hasConsent ? "confirmed" : "pending";
    }
    return "waitlist";
  });
}

export type QueueEntry = {
  id: string;
  status: EntryStatus;
  createdAt: Date | string;
  hasConsent: boolean;
};

/**
 * Tras una cancelación (o al ampliar plazas): quién sube desde la lista de
 * espera, por orden de llegada, y a qué estado.
 */
export function promoteFromWaitlist(
  entries: QueueEntry[],
  maxEntries: number | null
): { id: string; status: "confirmed" | "pending" }[] {
  const waiting = entries
    .filter((e) => e.status === "waitlist")
    .sort(
      (x, y) =>
        new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime()
    );
  const free =
    maxEntries == null
      ? waiting.length
      : Math.max(0, maxEntries - spotsTaken(entries));
  return waiting.slice(0, free).map((e) => ({
    id: e.id,
    status: e.hasConsent ? "confirmed" : "pending",
  }));
}

/** Posición en la lista de espera (1 = el siguiente), o null. */
export function waitlistPosition(
  entries: QueueEntry[],
  id: string
): number | null {
  const waiting = entries
    .filter((e) => e.status === "waitlist")
    .sort(
      (x, y) =>
        new Date(x.createdAt).getTime() - new Date(y.createdAt).getTime()
    );
  const i = waiting.findIndex((e) => e.id === id);
  return i < 0 ? null : i + 1;
}

export function normalizeEmail(v: string | null | undefined): string | null {
  const s = (v ?? "").trim().toLowerCase();
  return s.length ? s : null;
}

/**
 * Teléfono solo con dígitos y "+" inicial. Un número español de 9 cifras
 * se guarda con +34 para que "600 11 22 33" y "+34600112233" coincidan.
 */
export function normalizePhone(v: string | null | undefined): string | null {
  const raw = (v ?? "").trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (!digits) return null;
  if (raw.startsWith("+")) return `+${digits}`;
  if (digits.startsWith("00")) return `+${digits.slice(2)}`;
  if (digits.length === 9) return `+34${digits}`;
  digits = digits.replace(/^0+/, "");
  return `+${digits}`;
}

export type EntryIdentity = {
  status?: EntryStatus;
  studentId?: string | null;
  partnerStudentId?: string | null;
  email?: string | null;
  phone?: string | null;
  partnerEmail?: string | null;
  partnerPhone?: string | null;
};

function keys(e: EntryIdentity): string[] {
  const out: string[] = [];
  for (const id of [e.studentId, e.partnerStudentId]) {
    if (id) out.push(`s:${id}`);
  }
  for (const m of [e.email, e.partnerEmail]) {
    const n = normalizeEmail(m);
    if (n) out.push(`e:${n}`);
  }
  for (const p of [e.phone, e.partnerPhone]) {
    const n = normalizePhone(p);
    if (n) out.push(`p:${n}`);
  }
  return out;
}

/**
 * Para cada candidato, si ya está inscrito (como jugador o como pareja,
 * por alumno, correo o teléfono) en una inscripción no cancelada o en un
 * candidato anterior. Devuelve el índice de los duplicados.
 */
export function findDuplicates(
  existing: EntryIdentity[],
  candidates: EntryIdentity[]
): number[] {
  const seen = new Set<string>();
  for (const e of existing) {
    if (e.status === "cancelled") continue;
    keys(e).forEach((k) => seen.add(k));
  }
  const dups: number[] = [];
  candidates.forEach((c, i) => {
    const ks = keys(c);
    // La pareja no puede ser el propio jugador.
    if (new Set(ks).size !== ks.length || ks.some((k) => seen.has(k))) {
      dups.push(i);
      return;
    }
    ks.forEach((k) => seen.add(k));
  });
  return dups;
}

/**
 * Un alumno sin fecha de nacimiento cuenta como menor (regla de
 * lib/age.ts): el contacto será el de sus padres o tutores.
 */
export const isMinorStudent = (birthDate: string | null, today?: Date) =>
  !isAdult(birthDate, today);
