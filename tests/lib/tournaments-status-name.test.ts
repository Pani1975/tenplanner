import { describe, expect, it } from "vitest";
import {
  acceptsRegistrations,
  canEditEntries,
  canTransition,
  effectiveStatus,
  isPublic,
} from "@/lib/tournaments/status";
import { publicName, publicTeamName } from "@/lib/tournaments/public-name";
import { slugBase, tournamentSlug } from "@/lib/tournaments/slug";

const now = new Date("2026-11-19T12:00:00Z");
const past = "2026-11-19T11:59:00Z";
const future = "2026-11-20T00:00:00Z";

describe("estado del torneo", () => {
  it("cierre automático en la fecha límite", () => {
    expect(
      effectiveStatus({ status: "open", registrationDeadline: past }, now)
    ).toBe("closed");
    expect(
      effectiveStatus({ status: "open", registrationDeadline: future }, now)
    ).toBe("open");
    expect(
      effectiveStatus({ status: "open", registrationDeadline: null }, now)
    ).toBe("open");
    // Justo en la fecha límite ya está cerrado.
    expect(
      effectiveStatus(
        { status: "open", registrationDeadline: now.toISOString() },
        now
      )
    ).toBe("closed");
    // Otros estados no cambian.
    expect(
      effectiveStatus(
        { status: "in_progress", registrationDeadline: past },
        now
      )
    ).toBe("in_progress");
  });

  it("solo admite inscripciones abierto y en plazo", () => {
    expect(
      acceptsRegistrations(
        { status: "open", registrationDeadline: future },
        now
      )
    ).toBe(true);
    expect(
      acceptsRegistrations({ status: "open", registrationDeadline: past }, now)
    ).toBe(false);
    expect(
      acceptsRegistrations(
        { status: "draft", registrationDeadline: future },
        now
      )
    ).toBe(false);
  });

  it("el borrador no es público", () => {
    expect(isPublic({ status: "draft", registrationDeadline: null })).toBe(
      false
    );
    expect(isPublic({ status: "finished", registrationDeadline: null })).toBe(
      true
    );
  });

  it("transiciones", () => {
    const t = (
      status: "draft" | "open" | "closed" | "in_progress" | "finished",
      d: string | null = future
    ) => ({
      status,
      registrationDeadline: d,
    });
    expect(canTransition(t("draft"), "open", now)).toBe(true);
    expect(canTransition(t("draft"), "in_progress", now)).toBe(false);
    expect(canTransition(t("open"), "closed", now)).toBe(true);
    expect(canTransition(t("closed"), "in_progress", now)).toBe(true);
    expect(canTransition(t("in_progress"), "open", now)).toBe(false);
    // Cerrado por plazo: puede empezar, pero no reabrirse sin cambiar la fecha.
    expect(canTransition(t("open", past), "in_progress", now)).toBe(true);
    expect(canTransition(t("open", past), "open", now)).toBe(false);
    expect(canTransition(t("closed", past), "open", now)).toBe(false);
    expect(canTransition(t("closed", future), "open", now)).toBe(true);
  });

  it("participantes editables hasta que empieza", () => {
    expect(
      canEditEntries({ status: "closed", registrationDeadline: past }, now)
    ).toBe(true);
    expect(
      canEditEntries({ status: "in_progress", registrationDeadline: past }, now)
    ).toBe(false);
  });
});

describe("nombre público", () => {
  it("nombre e inicial del primer apellido; nunca contacto", () => {
    expect(publicName({ firstName: "Lucía", lastName: "García López" })).toBe(
      "Lucía G."
    );
    expect(publicName({ firstName: "Juan Carlos", lastName: "ñúñez" })).toBe(
      "Juan Ñ."
    );
    expect(publicName({ firstName: "Ana", lastName: null })).toBe("Ana");
    expect(publicName({ firstName: "  Ana  ", lastName: "  " })).toBe("Ana");
  });

  it("menores: solo iniciales por defecto", () => {
    expect(
      publicName({ firstName: "lucía", lastName: "García", isMinor: true })
    ).toBe("L. G.");
    expect(
      publicName(
        { firstName: "Lucía", lastName: "García", isMinor: true },
        { minorsInitialsOnly: false }
      )
    ).toBe("Lucía G.");
  });

  it("dobles", () => {
    expect(
      publicTeamName(
        { firstName: "Lucía", lastName: "García" },
        { firstName: "Marta", lastName: "Ruiz", isMinor: true }
      )
    ).toBe("Lucía G. / M. R.");
    expect(
      publicTeamName({ firstName: "Lucía", lastName: "García" }, null)
    ).toBe("Lucía G.");
  });
});

describe("slug", () => {
  it("legible y sin tildes", () => {
    expect(slugBase("Torneo de Navidad · Bola Naranja 2026!")).toBe(
      "torneo-de-navidad-bola-naranja-2026"
    );
    expect(slugBase("¡¡!!")).toBe("");
  });

  it("con sufijo aleatorio", () => {
    const s = tournamentSlug("Open Ñandú", () => 0);
    expect(s).toBe("open-nandu-aaaaaa");
    expect(tournamentSlug("")).toMatch(/^torneo-[a-z2-9]{6}$/);
    expect(tournamentSlug("x")).not.toBe(tournamentSlug("x"));
  });
});
