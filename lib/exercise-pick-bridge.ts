"use client";

/**
 * Puente entre el editor de una sesión/clase que se está creando y la ficha
 * de un ejercicio abierta desde ese editor (en otra pestaña).
 *
 * El editor genera un `pickerId` y abre la ficha con `?pick=<id>&para=sesion|clase`.
 * La ficha muestra entonces "Añadir a la sesión/clase que estás creando" y,
 * al pulsarlo, envía un mensaje por BroadcastChannel. El editor lo recibe,
 * añade el ejercicio al bloque desde el que se abrió y responde con un ack.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";

const CHANNEL_NAME = "tp-exercise-pick";

export type PickTargetKind = "sesion" | "clase";

type PickMessage = {
  type: "pick";
  pickerId: string;
  exerciseId: string;
  requestId: string;
};

type AckMessage = {
  type: "ack";
  requestId: string;
  ok: boolean;
  message: string;
};

export type PickResult = { ok: boolean; message: string };

function randomId() {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function openChannel(): BroadcastChannel | null {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return null;
  }
  try {
    return new BroadcastChannel(CHANNEL_NAME);
  } catch {
    return null;
  }
}

/** Enlace a la ficha de un ejercicio que permite añadirlo al editor abierto. */
export function pickExerciseHref(
  exerciseId: string,
  pickerId: string | null,
  kind: PickTargetKind
) {
  if (!pickerId) return `/exercises/${exerciseId}`;
  const p = new URLSearchParams({ pick: pickerId, para: kind });
  return `/exercises/${exerciseId}?${p.toString()}`;
}

/**
 * Lado del editor: escucha peticiones de "añadir" que llegan desde fichas
 * abiertas con su `pickerId`. `onPick` siempre se llama con la versión más
 * reciente (no hace falta memoizarla).
 */
export function useExercisePickListener(
  onPick: (exerciseId: string) => PickResult
): string | null {
  // Un id por pestaña, creado solo en el cliente (en el servidor es null)
  // para no romper la hidratación.
  const pickerId = useSyncExternalStore(
    noopSubscribe,
    getTabPickerId,
    () => null
  );
  const handlerRef = useRef(onPick);
  useEffect(() => {
    handlerRef.current = onPick;
  });

  useEffect(() => {
    if (!pickerId) return;
    const channel = openChannel();
    if (!channel) return;
    channel.onmessage = (event: MessageEvent<PickMessage>) => {
      const msg = event.data;
      if (!msg || msg.type !== "pick" || msg.pickerId !== pickerId) return;
      let result: PickResult;
      try {
        result = handlerRef.current(msg.exerciseId);
      } catch {
        result = { ok: false, message: "No se pudo añadir el ejercicio." };
      }
      const ack: AckMessage = {
        type: "ack",
        requestId: msg.requestId,
        ...result,
      };
      channel.postMessage(ack);
    };
    return () => channel.close();
  }, [pickerId]);

  return pickerId;
}

let tabPickerId: string | null = null;
function getTabPickerId() {
  if (!tabPickerId) tabPickerId = randomId();
  return tabPickerId;
}

function noopSubscribe() {
  return () => {};
}

/** Lee `?pick=...&para=...` de la URL actual (solo en el cliente). */
export function usePickParams(): {
  pickerId: string;
  kind: PickTargetKind;
} | null {
  const search = useSyncExternalStore(
    noopSubscribe,
    () => window.location.search,
    () => ""
  );
  const params = new URLSearchParams(search);
  const pickerId = params.get("pick");
  if (!pickerId) return null;
  return {
    pickerId,
    kind: params.get("para") === "clase" ? "clase" : "sesion",
  };
}

/** Lado de la ficha: pide al editor que añada el ejercicio y espera respuesta. */
export function requestExercisePick(
  pickerId: string,
  exerciseId: string,
  timeoutMs = 2500
): Promise<PickResult> {
  const channel = openChannel();
  if (!channel) {
    return Promise.resolve({
      ok: false,
      message:
        "Tu navegador no permite añadirlo desde aquí. Vuelve a la pestaña de la sesión y añádelo con el botón +.",
    });
  }
  const requestId = randomId();
  return new Promise((resolve) => {
    const timer = window.setTimeout(() => {
      channel.close();
      resolve({
        ok: false,
        message:
          "No encuentro la sesión o clase que estabas creando. Comprueba que su pestaña sigue abierta.",
      });
    }, timeoutMs);
    channel.onmessage = (event: MessageEvent<AckMessage>) => {
      const msg = event.data;
      if (!msg || msg.type !== "ack" || msg.requestId !== requestId) return;
      window.clearTimeout(timer);
      channel.close();
      resolve({ ok: msg.ok, message: msg.message });
    };
    const pick: PickMessage = { type: "pick", pickerId, exerciseId, requestId };
    channel.postMessage(pick);
  });
}
