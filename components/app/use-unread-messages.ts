"use client";

import { useCallback, useEffect, useState } from "react";

/** Evento que lanza la página de Mensajes al marcar mensajes como leídos. */
export const MESSAGES_READ_EVENT = "tp:messages-read";

const POLL_MS = 60_000;

/**
 * Número de mensajes nuevos para el menú. Parte del valor del servidor y se
 * refresca cada minuto, al volver a la pestaña y al leer mensajes.
 */
export function useUnreadMessages(initial: number, enabled: boolean) {
  const [count, setCount] = useState(initial);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/messages/unread", { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json();
      if (typeof body?.data?.count === "number") setCount(body.data.count);
    } catch {
      // sin conexión: se mantiene el último valor
    }
  }, []);

  useEffect(() => {
    setCount(initial);
  }, [initial]);

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, POLL_MS);
    function onVisible() {
      if (document.visibilityState === "visible") void refresh();
    }
    function onRead() {
      void refresh();
    }
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener(MESSAGES_READ_EVENT, onRead);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener(MESSAGES_READ_EVENT, onRead);
    };
  }, [enabled, refresh]);

  return count;
}

export function formatUnread(count: number) {
  return count > 99 ? "99+" : String(count);
}
