import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import {
  blocksFor,
  normalizeMetricIds,
  parseMetricParam,
  REPORT_BLOCKS,
  REPORT_METRIC_IDS,
} from "@/lib/club-report/catalog";
import type {
  ClubReportData,
  ReportSession,
  ReportStudent,
} from "@/lib/club-report/data";
import { formatPct, pctOf } from "@/lib/club-report/format";
import { ClubReportPdf } from "@/lib/club-report/pdf";
import { templateInputSchema } from "@/lib/club-report/templates";
import {
  buildMetricViews,
  countReasons,
  median,
  splitRatedExercises,
  type MetricView,
} from "@/lib/club-report/views";
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
    expect(
      rangeQuery(parseReportRange({ periodo: "90" }, now)).toString()
    ).toBe("periodo=90");
    expect(
      rangeQuery(
        parseReportRange(
          {
            periodo: "personalizado",
            desde: "2026-10-01",
            hasta: "2026-10-31",
          },
          now
        )
      ).toString()
    ).toBe("periodo=personalizado&desde=2026-10-01&hasta=2026-10-31");
  });
});

describe("cálculos del informe", () => {
  it("formatea porcentajes con dos decimales como mucho", () => {
    expect(formatPct(100 / 3)).toBe("33,33 %");
    expect(formatPct(50)).toBe("50 %");
    expect(formatPct(12.345)).toBe("12,35 %");
    expect(formatPct(null)).toBe("—");
    expect(pctOf(1, 3)).toBe(33.33);
    expect(pctOf(1, 0)).toBeNull();
  });

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
    const { best, worst } = splitRatedExercises(
      [
        { name: "A", average: 5, count: 2 },
        { name: "B", average: 4, count: 3 },
        { name: "C", average: 2, count: 1 },
      ],
      2
    );
    expect(best.map((e) => e.name)).toEqual(["A", "B"]);
    expect(worst.map((e) => e.name)).toEqual(["C"]);
  });
});

describe("catálogo del informe", () => {
  it("tiene ids únicos y los bloques pedidos", () => {
    expect(new Set(REPORT_METRIC_IDS).size).toBe(REPORT_METRIC_IDS.length);
    expect(REPORT_BLOCKS.map((b) => b.label)).toEqual(
      expect.arrayContaining([
        "Alumnos",
        "Monitores",
        "Sesiones",
        "Ejercicios",
        "Clases",
      ])
    );
  });

  it("normaliza y lee los datos elegidos", () => {
    expect(
      normalizeMetricIds([
        "alumnos_bajas",
        "x",
        "alumnos_resumen",
        "alumnos_bajas",
      ])
    ).toEqual(["alumnos_resumen", "alumnos_bajas"]);
    expect(parseMetricParam(null)).toEqual(REPORT_METRIC_IDS);
    expect(parseMetricParam("inventado")).toEqual(REPORT_METRIC_IDS);
    expect(parseMetricParam("sesiones_dia,alumnos_genero")).toEqual([
      "alumnos_genero",
      "sesiones_dia",
    ]);
  });

  it("agrupa por bloques solo los datos elegidos", () => {
    expect(
      blocksFor(["alumnos_altas", "alumnos_bajas", "alumnos_resumen"])
    ).toEqual([
      {
        id: "alumnos",
        label: "Alumnos",
        metrics: [
          { id: "alumnos_resumen", label: "Número de alumnos, altas y bajas" },
          { id: "alumnos_altas", label: "Altas y cómo nos conocieron" },
          { id: "alumnos_bajas", label: "Bajas y sus motivos" },
        ],
      },
    ]);
  });

  it("valida una plantilla: nombre y al menos un dato conocido", () => {
    expect(
      templateInputSchema.safeParse({
        name: " Altas y bajas ",
        metrics: ["alumnos_bajas", "x"],
      })
    ).toMatchObject({
      success: true,
      data: { name: "Altas y bajas", metrics: ["alumnos_bajas"] },
    });
    expect(
      templateInputSchema.safeParse({ name: "", metrics: ["alumnos_bajas"] })
        .success
    ).toBe(false);
    expect(
      templateInputSchema.safeParse({ name: "Vacía", metrics: ["x"] }).success
    ).toBe(false);
  });
});

function student(over: Partial<ReportStudent> & { id: string }): ReportStudent {
  return {
    name: over.id,
    coachName: "Ana",
    gender: null,
    birthDate: null,
    level: null,
    hand: null,
    locality: null,
    joinedAt: "2026-01-10",
    isSignup: false,
    howFound: null,
    howFoundDetail: null,
    isGone: false,
    leftInPeriod: false,
    leftAt: null,
    leftReason: null,
    leftReasonDetail: null,
    ...over,
  };
}

function session(over: Partial<ReportSession> & { id: string }): ReportSession {
  return {
    coachId: "u1",
    coachName: "Ana",
    minutes: 60,
    isoDow: 1,
    hour: 17,
    month: "2026-10",
    place: "Pista 1",
    groupId: null,
    intensity: null,
    rating: null,
    planFollowed: null,
    planChangeReason: null,
    sourceClassId: null,
    ...over,
  };
}

const range = parseReportRange({}, now);

const data: ClubReportData = {
  range,
  endDate: "2026-11-10",
  base: {
    range,
    coaches: 1,
    pendingInvites: 0,
    players: 3,
    newPlayers: 1,
    sessions: 3,
    minutes: 180,
    cancelled: 1,
    upcoming: 2,
    attendance: 66.67,
    objectives: 1,
    coachRows: [
      {
        id: "u1",
        name: "Ana",
        email: "ana@example.com",
        isOwner: false,
        players: 3,
        sessions: 3,
        minutes: 180,
        upcoming: 2,
        attendance: 66.67,
        lastSession: "2026-11-05T17:00:00.000Z",
      },
    ],
    playerRows: [],
  } as ClubReport,
  students: [
    student({
      id: "s1",
      name: "Lucía",
      gender: "female",
      birthDate: "2016-03-01",
      level: "consolidacion",
      locality: "Telde",
      howFound: "redes_sociales",
      isSignup: true,
      joinedAt: "2026-11-02",
    }),
    student({
      id: "s2",
      name: "Pablo",
      gender: "male",
      birthDate: "2014-05-01",
      locality: "telde ",
    }),
    student({
      id: "s3",
      name: "Marta",
      gender: "female",
      birthDate: "2012-01-01",
    }),
    student({
      id: "s4",
      name: "Iker",
      isGone: true,
      leftInPeriod: true,
      leftAt: "2026-10-20",
      leftReason: "economico",
    }),
  ],
  groups: [{ id: "g1", name: "Verde", studentIds: ["s1", "s2", "s4"] }],
  sessions: [
    session({
      id: "a",
      groupId: "g1",
      rating: 5,
      planFollowed: true,
      intensity: 3,
    }),
    session({
      id: "b",
      groupId: "g1",
      rating: 4,
      planFollowed: false,
      planChangeReason: "tiempo",
      isoDow: 3,
    }),
    session({ id: "c", rating: 4, isoDow: 3, hour: 9, sourceClassId: "k1" }),
  ],
  cancelled: [{ coachId: "u1", coachName: "Ana", note: "Lluvia" }],
  attendance: [
    { sessionId: "a", studentId: "s1", attended: true },
    { sessionId: "a", studentId: "s2", attended: false },
    { sessionId: "b", studentId: "s1", attended: true },
  ],
  exerciseUses: [
    { sessionId: "a", exerciseId: "e1", name: "Tres en raya" },
    { sessionId: "b", exerciseId: "e1", name: "Tres en raya" },
    { sessionId: "c", exerciseId: "e2", name: "Carrera" },
  ],
  exerciseRatings: [
    { exerciseId: "e1", name: "Tres en raya", rating: 5 },
    { exerciseId: "e2", name: "Carrera", rating: 2 },
  ],
  objectives: [{ studentId: "s1", aspect: "tecnico" }],
  exercisesCreated: 2,
  classes: [
    {
      id: "k1",
      name: "Clase verde",
      niveles: ["consolidacion"],
      aspectos: ["tecnica"],
      createdInPeriod: true,
    },
  ],
  classNames: new Map([["k1", "Clase verde"]]),
  bookings: [
    { place: "Pista 1", minutes: 90, kind: "public", cancelled: false },
    { place: "Pista 1", minutes: 60, kind: "club", cancelled: true },
  ],
  training: {
    sessionCount: 3,
    totalMinutes: 180,
    phases: [
      { key: "activation", minutes: 30, pct: 100 / 6 },
      { key: "main", minutes: 120, pct: 200 / 3 },
      { key: "cooldown", minutes: 30, pct: 100 / 6 },
    ],
    aspects: [
      { key: "tecnica", minutes: 60, pct: 100 / 3 },
      { key: "tactica", minutes: 60, pct: 100 / 3 },
      { key: "fisico", minutes: 60, pct: 100 / 3 },
      { key: "mental", minutes: 0, pct: 0 },
    ],
    types: [],
    strokes: [],
    topExercises: [],
  },
};

function text(view: MetricView | undefined): string {
  return JSON.stringify(view);
}

describe("vistas del informe", () => {
  const views = buildMetricViews(data, REPORT_METRIC_IDS);

  it("construye una vista por cada dato del catálogo", () => {
    expect([...views.keys()]).toEqual(REPORT_METRIC_IDS);
  });

  it("no cuenta como activos a los alumnos de baja", () => {
    const resumen = views.get("alumnos_resumen")!;
    expect(resumen.parts[0]).toMatchObject({
      kind: "stats",
      items: [
        { label: "Alumnos activos", value: "3" },
        { label: "Altas", value: "1" },
        { label: "Bajas", value: "1" },
        { label: "Variación", value: "0" },
      ],
    });
  });

  it("muestra los porcentajes con dos decimales", () => {
    expect(text(views.get("ejercicios_aspectos"))).toContain("33,33 %");
    expect(text(views.get("ejercicios_aspectos"))).not.toContain("33,333");
    expect(text(views.get("alumnos_genero"))).toContain("2 · 66,67 %");
    expect(text(views.get("sesiones_fases"))).toContain("66,67 %");
  });

  it("agrupa localidades sin distinguir mayúsculas ni espacios", () => {
    expect(text(views.get("alumnos_procedencia"))).toContain("2 · 100 %");
  });

  it("calcula altas, bajas y sus causas", () => {
    expect(text(views.get("alumnos_altas"))).toContain("Redes sociales");
    expect(text(views.get("alumnos_bajas"))).toContain("Motivos económicos");
  });

  it("calcula asistencia, frecuencia y alumnos por sesión", () => {
    expect(text(views.get("alumnos_asistencia"))).toContain("66,67 %");
    expect(views.get("sesiones_alumnos")!.parts[0]).toMatchObject({
      kind: "stats",
      items: expect.arrayContaining([{ label: "Media", value: "1" }]),
    });
  });

  it("calcula sesiones por día, canceladas y modificadas", () => {
    expect(text(views.get("sesiones_dia"))).toContain("Miércoles");
    expect(text(views.get("sesiones_canceladas"))).toContain("Lluvia");
    expect(text(views.get("sesiones_modificadas"))).toContain("Faltó tiempo");
    expect(text(views.get("sesiones_valoracion"))).toContain("4,33 / 5");
  });

  it("calcula ejercicios, clases y reservas", () => {
    expect(text(views.get("ejercicios_top"))).toContain("Tres en raya");
    expect(text(views.get("ejercicios_valorados"))).toContain("Carrera");
    expect(text(views.get("clases_usadas"))).toContain("Clase verde");
    expect(text(views.get("pistas_reservas"))).toContain("1,5 h");
  });

  it("explica cuando no hay datos", () => {
    const empty = buildMetricViews(
      {
        ...data,
        sessions: [],
        cancelled: [],
        attendance: [],
        exerciseUses: [],
        exerciseRatings: [],
      },
      ["sesiones_dia", "ejercicios_top"]
    );
    expect(empty.get("sesiones_dia")!.empty).toBeTruthy();
    expect(empty.get("sesiones_dia")!.parts).toEqual([]);
  });
});

describe("PDF del informe de gestión", () => {
  it("genera un PDF con todos los datos y con solo algunos", async () => {
    for (const metrics of [
      REPORT_METRIC_IDS,
      normalizeMetricIds(["alumnos_resumen", "alumnos_bajas"]),
    ]) {
      const element = createElement(ClubReportPdf, {
        clubName: "CT Paniagua",
        reportTitle: "Altas y bajas",
        periodLabel: "30 días",
        authorName: "Gestor",
        generatedAt: now,
        blocks: blocksFor(metrics),
        views: buildMetricViews(data, metrics),
      }) as ReactElement<DocumentProps>;
      const buffer = await renderToBuffer(element);
      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});
