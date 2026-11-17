// Destino de una sesión que se está preparando: para quién es (un grupo o
// uno o varios alumnos), cuándo, en cuántas pistas y dónde. Se elige al
// principio y viaja por los cuatro caminos de «Nueva sesión» (que la diseñe
// Ten Planner, elegir del catálogo, reutilizar una sesión pasada y crear
// desde cero) para que cada uno parta de lo ya decidido.
//
// Entre pantallas va en la URL (parámetros group, students, at, pistas,
// lugar, lugar2). Mientras el monitor mira el catálogo o sus sesiones
// pasadas se guarda además en sessionStorage, para poder ofrecer el botón
// «Añadir a la sesión» sin arrastrar parámetros por esas pantallas.

export type SessionTarget = {
  groupId: string | null;
  studentIds: string[];
  /** "YYYY-MM-DDTHH:mm" (hora local). */
  at: string;
  courts: 1 | 2;
  placeId: string | null;
  placeId2: string | null;
  /** Texto para mostrar ("Galácticas · lunes 23 de noviembre, 18:00"). */
  label?: string;
};

const KEY = "tp-session-target-v1";
/** El destino pendiente caduca a las 4 horas. */
const MAX_AGE_MS = 4 * 60 * 60 * 1000;

/** Parámetros de URL del destino (para el asistente y las demás pantallas). */
export function targetToParams(target: SessionTarget): URLSearchParams {
  const qs = new URLSearchParams();
  if (target.groupId) qs.set("group", target.groupId);
  if (target.studentIds.length > 0)
    qs.set("students", target.studentIds.join(","));
  if (target.at) qs.set("at", target.at);
  if (target.courts === 2) qs.set("pistas", "2");
  if (target.placeId) qs.set("lugar", target.placeId);
  if (target.courts === 2 && target.placeId2) qs.set("lugar2", target.placeId2);
  return qs;
}

type StoredTarget = SessionTarget & { savedAt: number };

export function saveTarget(target: SessionTarget) {
  try {
    const stored: StoredTarget = { ...target, savedAt: Date.now() };
    window.sessionStorage.setItem(KEY, JSON.stringify(stored));
    window.dispatchEvent(new Event(TARGET_EVENT));
  } catch {
    // Sin almacenamiento: solo se pierde el botón «Añadir a la sesión».
  }
}

/** Evento que avisa a las pantallas abiertas de que el destino cambió. */
export const TARGET_EVENT = "tp-session-target-changed";

/** Contenido crudo guardado (para useSyncExternalStore). */
export function rawTarget(): string | null {
  try {
    return window.sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function loadTarget(): SessionTarget | null {
  return parseTarget(rawTarget());
}

export function parseTarget(raw: string | null): SessionTarget | null {
  try {
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredTarget> | null;
    if (
      !stored ||
      typeof stored.savedAt !== "number" ||
      Date.now() - stored.savedAt > MAX_AGE_MS ||
      typeof stored.at !== "string"
    )
      return null;
    return {
      groupId: typeof stored.groupId === "string" ? stored.groupId : null,
      studentIds: Array.isArray(stored.studentIds)
        ? stored.studentIds.filter((id): id is string => typeof id === "string")
        : [],
      at: stored.at,
      courts: stored.courts === 2 ? 2 : 1,
      placeId: typeof stored.placeId === "string" ? stored.placeId : null,
      placeId2: typeof stored.placeId2 === "string" ? stored.placeId2 : null,
      label: typeof stored.label === "string" ? stored.label : undefined,
    };
  } catch {
    return null;
  }
}

export function clearTarget() {
  try {
    window.sessionStorage.removeItem(KEY);
    window.dispatchEvent(new Event(TARGET_EVENT));
  } catch {
    // ignorar
  }
}
