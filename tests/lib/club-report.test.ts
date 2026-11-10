import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import {
  countReasons,
  median,
  parseReportSections,
  REPORT_SECTION_IDS,
  splitRatedExercises,
  type ClubDetailReport,
} from "@/lib/club-report-detail";
import { ClubReportPdf } from "@/lib/club-report-pdf";
import {
  parseReportRange,
  rangeQuery,
  type ClubReport,
} from "@/lib/club-reports";

const now = new Date("2026-11-10T12:00:00Z");

describe("periodo del informe de gestión", () => {
  it("usa 30 días por defecto y acepta los periodos fijos", () => {
    expect(parseReportRange({}, now)).toMatchObject({
      kind: "preset",
      period: 30,
      label: "30 días",
    });
    expect(parseReportRange({ periodo: "90" }, now)).toMatchObject({
      kind: "preset",
      period: 90,
      label: "3 meses",
    });
    expect(parseReportRange({ periodo: "365" }, now)).toMatchObject({
      period: 365,
    });
    expect(parseReportRange({ periodo: "7" }, now)).toMatchObject({
      period: 30,
    });
  });

  it("acepta un periodo personalizado con ambas fechas incluidas", () => {
    const range = parseReportRange(
      { periodo: "personalizado", desde: "2026-10-01", hasta: "2026-10-31" },
      now
    );
    expect(range).toMatchObject({
      kind: "custom",
      fromDate: "2026-10-01",
      toDate: "2026-10-31",
      days: 31,
      label: "01/10/2026 – 31/10/2026",
    });
  });

  it("da la vuelta a un rango invertido y recorta el fin a hoy", () => {
    expect(
      parseReportRange(
        { periodo: "personalizado", desde: "2026-10-31", hasta: "2026-10-01" },
        now
      )
    ).toMatchObject({ fromDate: "2026-10-01", toDate: "2026-10-31" });

    expect(
      parseReportRange(
        { periodo: "personalizado", desde: "2026-11-01", hasta: "2027-03-01" },
        now
      )
    ).toMatchObject({ fromDate: "2026-11-01", toDate: "2026-11-10", days: 10 });
  });

  it("vuelve a 30 días si las fechas no son válidas o el inicio es futuro", () => {
    for (const params of [
      { periodo: "personalizado" },
      { periodo: "personalizado", desde: "2026-13-01", hasta: "2026-11-01" },
      { periodo: "personalizado", desde: "ayer", hasta: "hoy" },
      { periodo: "personalizado", desde: "2027-01-01", hasta: "2027-02-01" },
      { periodo: "personalizado", desde: "2000-01-01", hasta: "2026-11-01" },
    ]) {
      expect(parseReportRange(params, now)).toMatchObject({
        kind: "preset",
        period: 30,
      });
    }
  });

  it("describe el periodo en la URL", () => {
    expect(rangeQuery(parseReportRange({}, now)).toString()).toBe("");
    expect(rangeQuery(parseReportRange({ periodo: "90" }, now)).toString()).toBe(
      "periodo=90"
    );
    expect(
      rangeQuery(
        parseReportRange(
          { periodo: "personalizado", desde: "2026-10-01", hasta: "2026-10-31" },
          now
        )
      ).toString()
    ).toBe("periodo=personalizado&desde=2026-10-01&hasta=2026-10-31");
  });
});

describe("cálculos del informe", () => {
  it("calcula la mediana", () => {
    expect(median([])).toBeNull();
    expect(median([9])).toBe(9);
    expect(median([12, 8, 10])).toBe(10);
    expect(median([8, 9, 11, 14])).toBe(10);
  });

  it("agrupa motivos sin distinguir mayúsculas y pone los vacíos aparte", () => {
    expect(
      countReasons(
        ["Lluvia", "lluvia ", "Torneo", null, "  ", "LLUVIA"],
        "Sin motivo"
      )
    ).toEqual([
      { label: "Lluvia", count: 3 },
      { label: "Sin motivo", count: 2 },
      { label: "Torneo", count: 1 },
    ]);
  });

  it("separa mejor y peor valorados sin repetir ejercicios", () => {
    const rated = [
      { name: "A", average: 5, count: 2 },
      { name: "B", average: 4, count: 3 },
      { name: "C", average: 2, count: 1 },
    ];
    const { best, worst } = splitRatedExercises(rated, 2);
    expect(best.map((e) => e.name)).toEqual(["A", "B"]);
    expect(worst.map((e) => e.name)).toEqual(["C"]);
  });

  it("lee las secciones elegidas y por defecto las incluye todas", () => {
    expect(parseReportSections(null)).toEqual([...REPORT_SECTION_IDS]);
    expect(parseReportSections("")).toEqual([...REPORT_SECTION_IDS]);
    expect(parseReportSections("genero,inventada,edad")).toEqual([
      "genero",
      "edad",
    ]);
    expect(parseReportSections("inventada")).toEqual([...REPORT_SECTION_IDS]);
  });
});

describe("PDF del informe de gestión", () => {
  const base = {
    coachRows: [
      {
        id: "u1",
        name: "Ana",
        email: "ana@example.com",
        isOwner: false,
        players: 3,
        sessions: 4,
        minutes: 270,
        upcoming: 1,
        attendance: 90,
        lastSession: null,
      },
    ],
  } as unknown as ClubReport;

  const detail: ClubDetailReport = {
    students: {
      total: 5,
      groups: 2,
      gender: { male: 2, female: 2, other: 0, unknown: 1 },
      ageAverage: 10.4,
      ageMedian: 10,
      agesCounted: 4,
      origins: [{ label: "Telde", count: 3 }],
      withoutLocality: 2,
    },
    weekly: { average: 1.2, students: 4, weeks: 4.3 },
    signups: {
      count: 1,
      rows: [
        {
          name: "Luis",
          date: "2026-11-02",
          howFound: "Redes sociales",
        },
      ],
      howFound: [{ label: "Redes sociales", count: 1 }],
    },
    departures: {
      count: 1,
      rows: [{ name: "Marta", date: "2026-10-20", reason: "Motivos económicos" }],
      reasons: [{ label: "Motivos económicos", count: 1 }],
    },
    weekdays: ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"].map(
      (label, i) => ({ label, sessions: i % 3, minutes: 60 * (i % 3) })
    ),
    exercisesByCoach: [{ id: "u1", name: "Ana", uses: 12, distinct: 7 }],
    topExercises: [{ key: "e1", name: "Tres en raya", times: 4, minutes: 40 }],
    aspects: [
      { key: "tecnica", minutes: 60, pct: 50 },
      { key: "tactica", minutes: 30, pct: 25 },
      { key: "fisico", minutes: 30, pct: 25 },
      { key: "mental", minutes: 0, pct: 0 },
    ],
    sessionRating: { average: 4.2, rated: 3, sessions: 4 },
    bestExercises: [{ name: "Tres en raya", average: 4.8, count: 3 }],
    worstExercises: [{ name: "Carrera", average: 2.5, count: 2 }],
    cancelled: { count: 1, reasons: [{ label: "Lluvia", count: 1 }] },
    modified: { count: 1, answered: 3, reasons: [{ label: "Faltó tiempo", count: 1 }] },
  };

  it("genera un PDF con todas las secciones y con solo algunas", async () => {
    for (const sections of [[...REPORT_SECTION_IDS], ["genero" as const]]) {
      const element = createElement(ClubReportPdf, {
        clubName: "CT Paniagua",
        periodLabel: "30 días",
        coachName: "Gestor",
        generatedAt: now,
        sections,
        base,
        detail,
      }) as ReactElement<DocumentProps>;
      const buffer = await renderToBuffer(element);
      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});
