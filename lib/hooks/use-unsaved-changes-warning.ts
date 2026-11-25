"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Avisa antes de salir de un formulario con texto escrito sin guardar:
 * al recargar o cerrar la pestaña (aviso del navegador) y al pulsar un
 * enlace de la propia web (confirmación).
 *
 * Uso: poner `onInputCapture={markDirty}` en el contenedor del formulario
 * (solo cuenta lo que escribe el usuario) y llamar a `markSaved()` justo
 * antes de navegar tras guardar.
 */
export function useUnsavedChangesWarning() {
  const t = useTranslations("common");
  const message = t("unsavedChanges");
  const [dirty, setDirty] = useState(false);

  const markDirty = useCallback(() => setDirty(true), []);
  const markSaved = useCallback(() => setDirty(false), []);

  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Algunos navegadores aún lo necesitan para mostrar el aviso.
      event.returnValue = "";
    }

    // Fase de captura en document: llega antes que el onClick de <Link>.
    function onClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const target = event.target as Element | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      const here = window.location;
      // Solo cambia el ancla (#…): no se sale de la página.
      if (
        url.origin === here.origin &&
        url.pathname === here.pathname &&
        url.search === here.search
      )
        return;
      if (!window.confirm(message)) {
        event.preventDefault();
        event.stopPropagation();
      }
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, message]);

  return { dirty, markDirty, markSaved };
}
