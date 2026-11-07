import { describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ unstable_cache: <T>(fn: T) => fn }));
vi.mock("@/db", () => ({ db: {} }));

import {
  LANDING_DEFAULTS,
  LANDING_FIELD_DEFINITIONS,
  LANDING_STRING_KEYS,
  splitTitle,
} from "@/lib/landing-content";

describe("landing-content", () => {
  it("cada campo editable tiene valor por defecto dentro de su límite", () => {
    for (const field of LANDING_FIELD_DEFINITIONS) {
      const value = LANDING_DEFAULTS[field.key];
      expect(value.length, field.key).toBeGreaterThan(0);
      expect(value.length, field.key).toBeLessThanOrEqual(field.maxLength);
    }
  });

  it("las claves son únicas y usan el prefijo home_", () => {
    expect(new Set(LANDING_STRING_KEYS).size).toBe(LANDING_STRING_KEYS.length);
    expect(LANDING_STRING_KEYS.every((key) => key.startsWith("home_"))).toBe(
      true
    );
  });

  it("no promete datos no verificables ni limita a un solo deporte", () => {
    const all = Object.values(LANDING_DEFAULTS).join(" ");
    expect(all).not.toMatch(/200 monitores|14 días|inteligente/i);
  });

  it("splitTitle separa la primera línea del acento", () => {
    expect(splitTitle("Uno\nDos\nTres")).toEqual({
      main: "Uno",
      accent: "Dos Tres",
    });
    expect(splitTitle("Solo")).toEqual({ main: "Solo", accent: "" });
  });
});
