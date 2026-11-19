import { describe, expect, it } from "vitest";
import {
  consentRecord,
  isDirectConsent,
  TOURNAMENT_CONSENT_VERSION,
} from "@/lib/tournaments/consent";

const now = new Date("2026-11-19T10:00:00Z");

describe("consentRecord", () => {
  it("lo declara el monitor: queda su usuario, quién da el permiso y cuándo", () => {
    const r = consentRecord({
      method: "coach_declared",
      byUserId: "u1",
      byName: "  Madre de Lucía  ",
      now,
    });
    expect(r).toEqual({
      ok: true,
      record: {
        consentAt: now,
        consentVersion: TOURNAMENT_CONSENT_VERSION,
        consentMethod: "coach_declared",
        consentByUserId: "u1",
        consentByName: "Madre de Lucía",
      },
    });
  });

  it("declarado por el monitor sin usuario no vale", () => {
    expect(
      consentRecord({ method: "coach_declared", byName: "Ana", now })
    ).toEqual({ ok: false, error: "missing_user" });
  });

  it("siempre hace falta saber quién lo da", () => {
    expect(consentRecord({ method: "form", byName: "   ", now })).toEqual({
      ok: false,
      error: "missing_name",
    });
  });

  it("formulario público sin usuario", () => {
    const r = consentRecord({ method: "form", byName: "Ana Ruiz", now });
    expect(r.ok && r.record.consentByUserId).toBeNull();
  });
});

describe("isDirectConsent", () => {
  it("solo el del jugador o su tutor", () => {
    expect(isDirectConsent("form")).toBe(true);
    expect(isDirectConsent("guardian_link")).toBe(true);
    expect(isDirectConsent("coach_declared")).toBe(false);
    expect(isDirectConsent(null)).toBe(false);
  });
});
