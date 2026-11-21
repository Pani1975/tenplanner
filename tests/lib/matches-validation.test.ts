import { describe, expect, it } from "vitest";
import {
  normalizeResult,
  todayInSpain,
  validateMatch,
} from "@/lib/matches/validation";

const TODAY = "2026-11-21";

describe("normalizeResult", () => {
  it("acepta sets separados por espacios o comas", () => {
    expect(normalizeResult("6-4 3-6 10-8")).toBe("6-4 3-6 10-8");
    expect(normalizeResult("6-4,3-6,  10-8")).toBe("6-4 3-6 10-8");
    expect(normalizeResult("7-6(5) 6-3")).toBe("7-6(5) 6-3");
    expect(normalizeResult("6–4 6–2")).toBe("6-4 6-2");
  });

  it("rechaza formatos que no son sets", () => {
    expect(normalizeResult("ganamos")).toBeNull();
    expect(normalizeResult("6/4 6/2")).toBeNull();
    expect(normalizeResult("6-4 6-")).toBeNull();
    expect(normalizeResult("6-4 6-2 6-1 6-0 6-3 6-4")).toBeNull();
    expect(normalizeResult("")).toBeNull();
  });
});

describe("validateMatch", () => {
  it("exige el tipo de partido", () => {
    const r = validateMatch({ matchDate: TODAY }, TODAY);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errors.matchType).toBeDefined();
  });

  it("exige la fecha y no admite fechas futuras", () => {
    const sinFecha = validateMatch({ matchType: "entrenamiento" }, TODAY);
    expect(!sinFecha.ok && sinFecha.errors.matchDate).toBeTruthy();

    const futura = validateMatch(
      { matchType: "entrenamiento", matchDate: "2026-11-22" },
      TODAY
    );
    expect(!futura.ok && futura.errors.matchDate).toMatch(/posterior/);

    const invalida = validateMatch(
      { matchType: "entrenamiento", matchDate: "2026-02-30" },
      TODAY
    );
    expect(!invalida.ok && invalida.errors.matchDate).toMatch(/no es válida/);

    const hoy = validateMatch(
      { matchType: "entrenamiento", matchDate: TODAY },
      TODAY
    );
    expect(hoy.ok).toBe(true);
  });

  it("torneo: resultado obligatorio, rival y licencia opcionales", () => {
    const sinResultado = validateMatch(
      { matchType: "torneo", matchDate: TODAY },
      TODAY
    );
    expect(!sinResultado.ok && sinResultado.errors.finalResult).toBeTruthy();

    const ok = validateMatch(
      {
        matchType: "torneo",
        matchDate: TODAY,
        finalResult: "6-4 6-2",
        rivalLicense: "  12345 ",
        tournamentUrl: "https://example.com/torneo",
      },
      TODAY
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.data.rivalLicense).toBe("12345");
      expect(ok.data.rivalFirstName).toBeNull();
      expect(ok.data.tournamentUrl).toBe("https://example.com/torneo");
    }
  });

  it("valida el enlace", () => {
    const r = validateMatch(
      {
        matchType: "partido_oficial",
        matchDate: TODAY,
        finalResult: "6-4 6-2",
        tournamentUrl: "javascript:alert(1)",
      },
      TODAY
    );
    expect(!r.ok && r.errors.tournamentUrl).toBeTruthy();
  });

  it("amistoso: nombre del rival obligatorio y sin licencia", () => {
    const sinNombre = validateMatch(
      { matchType: "amistoso", matchDate: TODAY, finalResult: "6-4" },
      TODAY
    );
    expect(!sinNombre.ok && sinNombre.errors.rivalFirstName).toBeTruthy();

    const ok = validateMatch(
      {
        matchType: "amistoso",
        matchDate: TODAY,
        finalResult: "6-4",
        rivalFirstName: "Ana",
        rivalLicense: "999",
      },
      TODAY
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.data.rivalLicense).toBeNull();
  });

  it("entrenamiento: resultado opcional, sin enlace ni licencia", () => {
    const ok = validateMatch(
      {
        matchType: "entrenamiento",
        matchDate: TODAY,
        tournamentUrl: "https://example.com",
        rivalLicense: "123",
        rivalFirstName: "Luis",
      },
      TODAY
    );
    expect(ok.ok).toBe(true);
    if (ok.ok) {
      expect(ok.data.finalResult).toBeNull();
      expect(ok.data.tournamentUrl).toBeNull();
      expect(ok.data.rivalLicense).toBeNull();
      expect(ok.data.rivalFirstName).toBe("Luis");
    }

    const malResultado = validateMatch(
      { matchType: "entrenamiento", matchDate: TODAY, finalResult: "bien" },
      TODAY
    );
    expect(!malResultado.ok && malResultado.errors.finalResult).toBeTruthy();
  });
});

describe("todayInSpain", () => {
  it("usa la fecha de España", () => {
    // 23:30 UTC del 21 de noviembre = 00:30 del 22 en Madrid
    expect(todayInSpain(new Date("2026-11-21T23:30:00Z"))).toBe("2026-11-22");
  });
});

describe("torneo y perfil público", () => {
  it("guarda el nombre del torneo salvo en entrenamiento", () => {
    const t = validateMatch(
      {
        matchType: "torneo",
        matchDate: TODAY,
        finalResult: "6-4",
        tournamentName: " Open de Invierno ",
        showOnProfile: true,
      },
      TODAY
    );
    expect(t.ok && t.data.tournamentName).toBe("Open de Invierno");
    expect(t.ok && t.data.showOnProfile).toBe(true);

    const e = validateMatch(
      { matchType: "entrenamiento", matchDate: TODAY, tournamentName: "X" },
      TODAY
    );
    expect(e.ok && e.data.tournamentName).toBeNull();
    expect(e.ok && e.data.showOnProfile).toBe(false);
  });
});
