import { describe, expect, it } from "vitest";
import {
  imageConsentStatus,
  withoutImageConsent,
} from "@/lib/tournaments/image-consent";

describe("imageConsentStatus", () => {
  it("alumno: según su ficha (sí, no o sin datos)", () => {
    expect(imageConsentStatus({ isStudent: true, studentConsent: true })).toBe(
      "yes"
    );
    expect(imageConsentStatus({ isStudent: true, studentConsent: false })).toBe(
      "no"
    );
    expect(imageConsentStatus({ isStudent: true, studentConsent: null })).toBe(
      "unknown"
    );
    // En un alumno, lo de la inscripción no cuenta: manda la ficha.
    expect(
      imageConsentStatus({
        isStudent: true,
        studentConsent: null,
        entryConsentAt: new Date(),
      })
    ).toBe("unknown");
  });

  it("externo: según su inscripción", () => {
    expect(
      imageConsentStatus({ isStudent: false, entryConsentAt: new Date() })
    ).toBe("yes");
    expect(imageConsentStatus({ isStudent: false, entryConsentAt: null })).toBe(
      "unknown"
    );
  });
});

describe("withoutImageConsent", () => {
  it("devuelve quienes no tienen autorización (no o sin datos)", () => {
    const people = [
      { name: "A", image: "yes" as const },
      { name: "B", image: "no" as const },
      { name: "C", image: "unknown" as const },
    ];
    expect(withoutImageConsent(people).map((p) => p.name)).toEqual(["B", "C"]);
  });
});
