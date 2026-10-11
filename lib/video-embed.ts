// Convierte un enlace de YouTube (watch, youtu.be, shorts, embed, live) en la
// URL del reproductor para incrustarlo con un iframe. Se respeta el minuto de
// inicio (?t= / ?start=). Devuelve null si el enlace no es de YouTube, para que
// la ficha muestre solo el enlace externo.
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

function parseStartSeconds(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+$/.test(value)) return Number(value);
  const match = value.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/);
  if (!match || !match[0]) return null;
  const [, h, m, s] = match;
  return Number(h ?? 0) * 3600 + Number(m ?? 0) * 60 + Number(s ?? 0);
}

export function getYouTubeEmbedUrl(
  url: string | null | undefined
): string | null {
  if (!url) return null;
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
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
  if (!id || !YOUTUBE_ID.test(id)) return null;

  const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
  const start = parseStartSeconds(
    parsed.searchParams.get("t") ?? parsed.searchParams.get("start")
  );
  if (start) embed.searchParams.set("start", String(start));
  return embed.toString();
}
