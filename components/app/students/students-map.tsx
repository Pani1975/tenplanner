"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { OriginPoint } from "@/lib/students/stats";

const ACCENT = "#A3C520";

/** Radio del círculo en píxeles: crece con la raíz del nº de alumnos. */
function radiusFor(count: number, max: number) {
  const scale = Math.sqrt(count / Math.max(max, 1));
  return Math.round(8 + scale * 20);
}

/**
 * Mapa de procedencia: un círculo por localidad, tanto más grande cuantos más
 * alumnos. Usa Leaflet con teselas de OpenStreetMap; no se envía ningún dato
 * de los alumnos, solo se piden las imágenes del mapa.
 */
export function StudentsMap({ origins }: { origins: OriginPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || origins.length === 0) return;

    const map = L.map(el, { scrollWheelZoom: false, attributionControl: true });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    const max = Math.max(...origins.map((o) => o.count));
    const layers = origins.map((o) =>
      L.circleMarker([o.lat, o.lng], {
        radius: radiusFor(o.count, max),
        color: "#3F5A00",
        weight: 1.5,
        fillColor: ACCENT,
        fillOpacity: 0.7,
      })
        .bindTooltip(`${o.name}: ${o.count} alumno${o.count !== 1 ? "s" : ""}`)
        .addTo(map)
    );

    const group = L.featureGroup(layers);
    map.fitBounds(group.getBounds().pad(0.3), { maxZoom: 12 });

    return () => {
      map.remove();
    };
  }, [origins]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label="Mapa de procedencia de los alumnos"
      className="h-72 w-full overflow-hidden rounded-xl border border-border"
    />
  );
}
