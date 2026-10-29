import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import {
  SESSION_AUDIO_MAX_SECONDS,
  audioExtension,
  baseAudioMime,
} from "@/lib/session-audio";

describe("session audio helpers", () => {
  it("quita los parámetros del tipo MIME", () => {
    expect(baseAudioMime("audio/webm;codecs=opus")).toBe("audio/webm");
    expect(baseAudioMime(" Audio/MP4 ")).toBe("audio/mp4");
  });

  it("asigna extensión a los formatos que graban los navegadores", () => {
    expect(audioExtension("audio/webm;codecs=opus")).toBe("webm");
    expect(audioExtension("audio/mp4")).toBe("m4a");
    expect(audioExtension("audio/ogg;codecs=opus")).toBe("ogg");
  });

  it("rechaza formatos que no son audio admitido", () => {
    expect(audioExtension("video/mp4")).toBeNull();
    expect(audioExtension("application/octet-stream")).toBeNull();
    expect(audioExtension("")).toBeNull();
  });

  it("limita las notas de voz a 2 minutos", () => {
    expect(SESSION_AUDIO_MAX_SECONDS).toBe(120);
  });
});
