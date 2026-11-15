// Utilidades para enlaces de vídeo externos (YouTube, Google Drive...).
// getYouTubeEmbedUrl convierte un enlace de YouTube (watch, youtu.be, shorts,
// embed, live) en la URL del reproductor para incrustarlo con un iframe. Se
// respeta el minuto de inicio (?t= / ?start=). Devuelve null si el enlace no es
// de YouTube, para que la ficha muestre solo el enlace externo.
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;
const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);

function parseStartSeconds(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || !match[0]) return null;
  const [, h, m, s] = match;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

/** URL http(s) válida o null. */
function parseHttpUrl(url: string | null | undefined): URL | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (!parsed.hostname.includes(".")) return null;
  return parsed;
}

function youTubeIdFrom(parsed: URL): string | null {
  const host = parsed.hostname.toLowerCase();
  if (!YOUTUBE_HOSTS.has(host)) return null;
  let id: string | null = null;
  if (host.endsWith("youtu.be")) {
    id = parsed.pathname.split("/")[1] ?? null;
  } else if (parsed.pathname === "/watch") {
    id = parsed.searchParams.get("v");
  } else {
    const [, kind, value] = parsed.pathname.split("/");
    if (kind === "shorts" || kind === "embed" || kind === "live") {
      id = value ?? null;
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** Identificador del vídeo de YouTube o null si el enlace no es de YouTube. */
export function getYouTubeVideoId(
  url: string | null | undefined
): string | null {
  const parsed = parseHttpUrl(url);
  return parsed ? youTubeIdFrom(parsed) : null;
}

export function getYouTubeEmbedUrl(
  url: string | null | undefined
): string | null {
  const parsed = parseHttpUrl(url);
  const id = parsed ? youTubeIdFrom(parsed) : null;
  if (!parsed || !id) return null;

  const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  const start = parseStartSeconds(
    parsed.searchParams.get("t") ?? parsed.searchParams.get("start")
  );
  if (start) embed.searchParams.set("start", String(start));
  return embed.toString();
}

/** Miniatura pública del vídeo de YouTube (i.ytimg.com) o null. */
export function getYouTubeThumbnailUrl(
  url: string | null | undefined
): string | null {
  const id = getYouTubeVideoId(url);
  return id ? `https://i.ytimg.com/vi/${id}/hqdefault.jpg` : null;
}

export type VideoLinkKind = "youtube" | "drive" | "other";

/**
 * Normaliza un enlace de vídeo escrito por el monitor: añade https:// si falta
 * y comprueba que es una URL http(s) válida. Devuelve null si no lo es.
 */
export function normalizeVideoUrl(
  input: string | null | undefined
): { url: string; kind: VideoLinkKind } | null {
  const raw = input?.trim();
  if (!raw || /\s/.test(raw)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
  const parsed = parseHttpUrl(withScheme);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();
  const kind: VideoLinkKind = youTubeIdFrom(parsed)
    ? "youtube"
    : DRIVE_HOSTS.has(host)
      ? "drive"
      : "other";
  return { url: parsed.toString(), kind };
}
