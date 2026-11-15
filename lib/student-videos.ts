import { z } from "zod";
import type { studentVideos } from "@/db/schema";
import { normalizeVideoUrl } from "@/lib/video-embed";

/** Ficha de vídeo tal como la ven los componentes de cliente. */
export interface StudentVideoItem {
  id: string;
  location: string | null;
  event: string | null;
  /** YYYY-MM-DD */
  recordedOn: string | null;
  notes: string | null;
  videoUrl: string;
}

export type StudentVideoFormInput = {
  location?: string | null;
  event?: string | null;
  recordedOn?: string | null;
  notes?: string | null;
  videoUrl: string;
};

export type VideoActionResult =
  | { ok: true; video: StudentVideoItem }
  | { ok: false; error: string };

/** Acciones que usa el panel: las del monitor o las de la familia. */
export interface StudentVideoActions {
  create(
    studentId: string,
    input: StudentVideoFormInput
  ): Promise<VideoActionResult>;
  update(
    studentId: string,
    videoId: string,
    input: StudentVideoFormInput
  ): Promise<VideoActionResult>;
  remove(
    studentId: string,
    videoId: string
  ): Promise<{ ok: true } | { ok: false; error: string }>;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (value: string) => UUID_RE.test(value);

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const videoSchema = z.object({
  location: optionalText(200),
  event: optionalText(200),
  recordedOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable()
    .or(z.literal(""))
    .transform((v) => (v ? v : null)),
  notes: optionalText(2000),
  videoUrl: z.string().trim().min(1).max(2000),
});

/** Valida y normaliza lo que llega del formulario. */
export function parseVideoInput(input: StudentVideoFormInput) {
  const parsed = videoSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false as const, error: "Revisa los datos de la ficha." };
  }
  const link = normalizeVideoUrl(parsed.data.videoUrl);
  if (!link) {
    return {
      ok: false as const,
      error: "El enlace no es válido. Pega la dirección completa del vídeo.",
    };
  }
  return { ok: true as const, data: { ...parsed.data, videoUrl: link.url } };
}

export function toVideoItem(
  row: typeof studentVideos.$inferSelect
): StudentVideoItem {
  return {
    id: row.id,
    location: row.location,
    event: row.event,
    recordedOn: row.recordedOn,
    notes: row.notes,
    videoUrl: row.videoUrl,
  };
}
