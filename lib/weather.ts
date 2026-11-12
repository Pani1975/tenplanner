// Previsión del tiempo para el Panel de gestión, con Open-Meteo (gratis y sin
// clave). Solo se envía el nombre de una localidad, sacado de la dirección del
// club; si no se encuentra, el Panel lo dice en vez de fallar.

export interface DayForecast {
  /** AAAA-MM-DD */
  date: string;
  max: number;
  min: number;
  /** Probabilidad de lluvia (%), si la hay. */
  rainChance: number | null;
  label: string;
  icon: string;
}

export interface Forecast {
  place: string;
  days: DayForecast[];
}

// Códigos WMO → texto corto y emoji.
function describe(code: number): { label: string; icon: string } {
  if (code === 0) return { label: "Despejado", icon: "☀️" };
  if (code <= 2) return { label: "Poco nuboso", icon: "🌤️" };
  if (code === 3) return { label: "Nublado", icon: "☁️" };
  if (code === 45 || code === 48) return { label: "Niebla", icon: "🌫️" };
  if (code >= 51 && code <= 57) return { label: "Llovizna", icon: "🌦️" };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82))
    return { label: "Lluvia", icon: "🌧️" };
  if (code >= 71 && code <= 77) return { label: "Nieve", icon: "🌨️" };
  if (code >= 95) return { label: "Tormenta", icon: "⛈️" };
  return { label: "Variable", icon: "⛅" };
}

/** Localidades candidatas de una dirección: de la última parte a la primera. */
export function placeCandidates(address: string | null | undefined): string[] {
  if (!address) return [];
  return address
    .split(/[,\n]/)
    .map((part) => part.replace(/\d+/g, "").replace(/\s+/g, " ").trim())
    .filter((part) => part.length >= 3)
    .reverse()
    .slice(0, 3);
}

async function geocode(
  name: string
): Promise<{ lat: number; lon: number; name: string } | null> {
  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", name);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "es");
  const res = await fetch(url, { next: { revalidate: 60 * 60 * 24 } });
  if (!res.ok) return null;
  const json = (await res.json()) as {
    results?: { latitude: number; longitude: number; name: string }[];
  };
  const hit = json.results?.[0];
  return hit ? { lat: hit.latitude, lon: hit.longitude, name: hit.name } : null;
}

/** Previsión de hoy y los dos días siguientes, o null si no se puede obtener. */
export async function loadForecast(
  address: string | null | undefined
): Promise<Forecast | null> {
  try {
    for (const candidate of placeCandidates(address)) {
      const spot = await geocode(candidate);
      if (!spot) continue;
      const url = new URL("https://api.open-meteo.com/v1/forecast");
      url.searchParams.set("latitude", String(spot.lat));
      url.searchParams.set("longitude", String(spot.lon));
      url.searchParams.set(
        "daily",
        "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max"
      );
      url.searchParams.set("timezone", "auto");
      url.searchParams.set("forecast_days", "3");
      const res = await fetch(url, { next: { revalidate: 60 * 30 } });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        daily?: {
          time: string[];
          weather_code: number[];
          temperature_2m_max: number[];
          temperature_2m_min: number[];
          precipitation_probability_max: (number | null)[];
        };
      };
      const d = json.daily;
      if (!d) continue;
      return {
        place: spot.name,
        days: d.time.map((date, i) => ({
          date,
          max: Math.round(d.temperature_2m_max[i]),
          min: Math.round(d.temperature_2m_min[i]),
          rainChance: d.precipitation_probability_max[i] ?? null,
          ...describe(d.weather_code[i]),
        })),
      };
    }
  } catch (error) {
    console.error("Forecast failed", { error });
  }
  return null;
}
