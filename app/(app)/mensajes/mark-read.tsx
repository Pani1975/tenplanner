"use client";

import { useEffect, useRef } from "react";
import { MESSAGES_READ_EVENT } from "@/components/app/use-unread-messages";

/**
 * Al abrir Mensajes, marca como leídos los mensajes nuevos que se están
 * mostrando y avisa al menú para que actualice el contador. La etiqueta
 * "Nuevo" se mantiene hasta la próxima visita.
 */
export function MarkMessagesRead({ ids }: { ids: string[] }) {
  const sent = useRef(false);
  useEffect(() => {
    if (sent.current || ids.length === 0) return;
    sent.current = true;
    void fetch("/api/messages/read", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids }),
    })
      .then(() => window.dispatchEvent(new Event(MESSAGES_READ_EVENT)))
      .catch(() => {});
  }, [ids]);
  return null;
}
