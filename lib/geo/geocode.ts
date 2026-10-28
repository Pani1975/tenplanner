export interface GeoPoint {
  lat: number;
  lng: number;
}

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const TIMEOUT_MS = 4000;

/**
 * Coordenadas aproximadas de una localidad española, con Nominatim
 * (OpenStreetMap). Solo se envía el nombre de la localidad, nunca datos del
 * alumno. Es una ayuda para el mapa de procedencia: ante cualquier fallo
 * (red, límite de uso, localidad desconocida) devuelve null y el alumno se
 * guarda igual, sin punto en el mapa.
 */
export async function geocodeLocality(
  locality: string,
  fetchImpl: typeof fetch = fetch
): Promise<GeoPoint | null> {
  const query = locality.trim();
  if (!query) return null;

  const url = new URL(NOMINATIM_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "es");
  url.searchParams.set("accept-language", "es");

  try {
    const res = await fetchImpl(url, {
      headers: { "User-Agent": "TenPlanner/1.0 (https://tenplanner.com)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const first = data[0] as { lat?: unknown; lon?: unknown };
    const lat = Number(first.lat);
    const lng = Number(first.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}
