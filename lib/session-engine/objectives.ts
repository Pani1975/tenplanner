// Objetivos de la sesión → golpes y aspectos que orientan la propuesta.
// Los objetivos son texto libre (uno por línea, del grupo o escritos sobre
// la marcha); aquí se buscan palabras clave sin tildes ni mayúsculas.

import { normalizeSearchText } from "@/lib/exercises/search";
import type { Golpe } from "./types";

export type ObjectiveFocus = {
  golpes: Golpe[];
  aspectos: string[];
};

// Raíces: se buscan como inicio de palabra ("volea" encuentra "voleas").
const GOLPE_KEYS: [Golpe, string[]][] = [
  ["saque", ["saque", "servicio", "servir"]],
  ["resto", ["resto", "restar", "devolucion"]],
  ["volea", ["volea", "red"]],
  ["remate", ["remate", "smash"]],
  ["globo", ["globo"]],
  ["dejada", ["dejada"]],
  ["derecha", ["derecha", "drive"]],
  ["reves", ["reves"]],
];

const ASPECT_KEYS: [string, string[]][] = [
  ["tecnica", ["tecnica", "tecnico", "golpeo", "empunadura", "peloteo"]],
  [
    "tactica",
    ["tactica", "tactico", "situacion", "situaciones", "estrategia", "juego"],
  ],
  [
    "fisico",
    [
      "fisico",
      "coordinacion",
      "agilidad",
      "desplazamiento",
      "velocidad",
      "resistencia",
    ],
  ],
  ["mental", ["mental", "concentracion", "confianza", "seguridad", "atencion"]],
];

function hasKey(words: string[], keys: string[]): boolean {
  return words.some((w) => keys.some((k) => w === k || w.startsWith(k)));
}

/** Golpes y aspectos que aparecen en los objetivos, en orden de aparición. */
export function parseObjectives(
  text: string | null | undefined
): ObjectiveFocus {
  const golpes: Golpe[] = [];
  const aspectos: string[] = [];
  for (const line of (text ?? "").split(/\r?\n/)) {
    const words = normalizeSearchText(line).split(" ").filter(Boolean);
    if (words.length === 0) continue;
    for (const [g, keys] of GOLPE_KEYS) {
      // "red" solo cuenta como volea si no hay otro golpe en la línea.
      if (g === "volea" && !words.some((w) => w.startsWith("volea"))) {
        if (!words.includes("red")) continue;
        if (GOLPE_KEYS.some(([o, k]) => o !== "volea" && hasKey(words, k)))
          continue;
      } else if (!hasKey(words, keys)) continue;
      if (!golpes.includes(g)) golpes.push(g);
    }
    for (const [a, keys] of ASPECT_KEYS) {
      if (hasKey(words, keys) && !aspectos.includes(a)) aspectos.push(a);
    }
  }
  return { golpes, aspectos };
}
