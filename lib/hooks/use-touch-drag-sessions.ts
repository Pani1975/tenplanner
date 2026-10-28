"use client";

import { useEffect, useRef } from "react";

/**
 * Arrastre táctil (móvil / tablet) de sesiones del calendario.
 *
 * El drag & drop nativo de HTML5 no funciona con el dedo, así que se
 * implementa aparte: pulsación larga sobre un elemento con
 * `data-session-drag-id` y, sin soltar, arrastrar hasta una celda con
 * `data-drop-date="AAAA-MM-DD"`. Un toque o un desplazamiento normal
 * (scroll) no activan nada.
 */
const LONG_PRESS_MS = 250;
const MOVE_TOLERANCE_PX = 16;
const EDGE_SCROLL_PX = 60;

export function useTouchDragSessions({
  onDrop,
  onHover,
}: {
  onDrop: (sessionId: string, dateKey: string) => void;
  onHover: (dateKey: string | null) => void;
}) {
  // Siempre las últimas funciones, sin re-registrar los listeners.
  const handlers = useRef({ onDrop, onHover });
  useEffect(() => {
    handlers.current = { onDrop, onHover };
  });

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let candidate: {
      el: HTMLElement;
      id: string;
      x: number;
      y: number;
    } | null = null;
    let active: { id: string; ghost: HTMLElement; over: string | null } | null =
      null;
    let lastY = 0;
    let scrollRaf: number | null = null;
    let pressedEl: HTMLElement | null = null;

    function clearTimer() {
      if (timer) clearTimeout(timer);
      timer = null;
    }

    function dateKeyAt(x: number, y: number): string | null {
      const el = document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>("[data-drop-date]");
      return el?.dataset.dropDate ?? null;
    }

    function moveGhost(x: number, y: number) {
      if (!active) return;
      active.ghost.style.transform = `translate(${x - 40}px, ${y - 56}px)`;
    }

    function autoScroll() {
      if (!active) return;
      if (lastY < EDGE_SCROLL_PX) window.scrollBy(0, -10);
      else if (lastY > window.innerHeight - EDGE_SCROLL_PX)
        window.scrollBy(0, 10);
      scrollRaf = requestAnimationFrame(autoScroll);
    }

    function start() {
      if (!candidate) return;
      const { el, id, x, y } = candidate;
      const ghost = document.createElement("div");
      ghost.textContent = el.textContent;
      ghost.className =
        "pointer-events-none fixed left-0 top-0 z-[100] max-w-[220px] truncate rounded-full bg-brand px-3 py-1.5 text-xs font-bold text-brand-foreground shadow-xl";
      document.body.appendChild(ghost);
      active = { id, ghost, over: null };
      lastY = y;
      moveGhost(x, y);
      if (navigator.vibrate) navigator.vibrate(15);
      scrollRaf = requestAnimationFrame(autoScroll);
    }

    function restoreDraggable() {
      if (pressedEl) pressedEl.draggable = true;
      pressedEl = null;
    }

    function finish(drop: boolean) {
      clearTimer();
      candidate = null;
      restoreDraggable();
      if (!active) return;
      const { id, ghost, over } = active;
      active = null;
      ghost.remove();
      if (scrollRaf !== null) cancelAnimationFrame(scrollRaf);
      scrollRaf = null;
      handlers.current.onHover(null);
      if (drop && over) handlers.current.onDrop(id, over);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length !== 1) return finish(false);
      const target = (e.target as HTMLElement | null)?.closest<HTMLElement>(
        "[data-session-drag-id]"
      );
      if (!target) return;
      const t = e.touches[0];
      // Con el dedo el navegador (Chrome Android) arrancaría su propio drag
      // del enlace y abriría su menú contextual: se desactiva mientras dura
      // el toque.
      pressedEl = target;
      target.draggable = false;
      candidate = {
        el: target,
        id: target.dataset.sessionDragId!,
        x: t.clientX,
        y: t.clientY,
      };
      clearTimer();
      timer = setTimeout(start, LONG_PRESS_MS);
    }

    function onTouchMove(e: TouchEvent) {
      const t = e.touches[0];
      if (!t) return;
      if (!active) {
        // Se movió antes de la pulsación larga: es un scroll, no un arrastre.
        if (
          candidate &&
          Math.hypot(t.clientX - candidate.x, t.clientY - candidate.y) >
            MOVE_TOLERANCE_PX
        ) {
          clearTimer();
          candidate = null;
        }
        return;
      }
      e.preventDefault(); // evita que la página haga scroll mientras se arrastra
      lastY = t.clientY;
      moveGhost(t.clientX, t.clientY);
      const over = dateKeyAt(t.clientX, t.clientY);
      if (over !== active.over) {
        active.over = over;
        handlers.current.onHover(over);
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (active) {
        e.preventDefault(); // no abrir el enlace de la sesión al soltar
        finish(true);
      } else {
        clearTimer();
        candidate = null;
        restoreDraggable();
      }
    }

    function onTouchCancel() {
      finish(false);
    }

    // El navegador puede intentar su propio drag del enlace o el menú
    // contextual durante la pulsación larga.
    function onNativeInterference(e: Event) {
      if (candidate || active) {
        e.preventDefault();
        return;
      }
      // Menú contextual de Chrome Android al mantener pulsada una sesión.
      if (
        e.type === "contextmenu" &&
        (e.target as HTMLElement | null)?.closest("[data-session-drag-id]") &&
        window.matchMedia("(pointer: coarse)").matches
      ) {
        e.preventDefault();
      }
    }

    const opts = { passive: false } as const;
    document.addEventListener("touchstart", onTouchStart, { passive: true });
    document.addEventListener("touchmove", onTouchMove, opts);
    document.addEventListener("touchend", onTouchEnd, opts);
    document.addEventListener("touchcancel", onTouchCancel);
    document.addEventListener("dragstart", onNativeInterference);
    document.addEventListener("contextmenu", onNativeInterference);
    return () => {
      finish(false);
      document.removeEventListener("touchstart", onTouchStart);
      document.removeEventListener("touchmove", onTouchMove);
      document.removeEventListener("touchend", onTouchEnd);
      document.removeEventListener("touchcancel", onTouchCancel);
      document.removeEventListener("dragstart", onNativeInterference);
      document.removeEventListener("contextmenu", onNativeInterference);
    };
  }, []);
}
