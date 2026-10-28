import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { renderToBuffer } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { geocodeLocality } from "@/lib/geo/geocode";
import {
  ageOn,
  buildStudentsStats,
  studentsLabel,
  type StatsStudent,
} from "@/lib/students/stats";
import { StudentsStatsPdf } from "@/lib/students/stats-pdf";

const now = new Date("2026-10-28T12:00:00Z");

function student(
  overrides: Partial<StatsStudent> & { id: string }
): StatsStudent {
  return {
    name: overrides.id,
    birthDate: null,
    playerLevel: null,
    locality: null,
    localityLat: null,
    localityLng: null,
    ...overrides,
  };
}

describe("studentsLabel", () => {
  it("usa singular y plural", () => {
    expect(studentsLabel(0)).toBe("0 alumnos");
    expect(studentsLabel(1)).toBe("1 alumno");
    expect(studentsLabel(2)).toBe("2 alumnos");
  });
});

describe("ageOn", () => {
  it("cuenta años cumplidos", () => {
    expect(ageOn("2016-10-28", now)).toBe(10);
    expect(ageOn("2016-10-29", now)).toBe(9);
    expect(ageOn("2016-01-01", now)).toBe(10);
  });

  it("ignora fechas inválidas o absurdas", () => {
    expect(ageOn(null, now)).toBeNull();
    expect(ageOn("no-es-fecha", now)).toBeNull();
    expect(ageOn("2030-01-01", now)).toBeNull();
    expect(ageOn("1800-01-01", now)).toBeNull();
  });
});

describe("buildStudentsStats", () => {
  const students = [
    student({
      id: "a",
      name: "Ana",
      playerLevel: "descubrimiento",
      birthDate: "2021-03-01",
    }),
    student({
      id: "b",
      name: "Bea",
      playerLevel: "desarrollo",
      birthDate: "2018-05-05",
    }),
    student({
      id: "c",
      name: "Carlos",
      playerLevel: "beginner",
      birthDate: "2008-02-02",
    }),
    student({ id: "d", name: "Dani", playerLevel: null, birthDate: null }),
    student({
      id: "e",
      name: "Eva",
      playerLevel: "desarrollo",
      birthDate: "1990-01-01",
    }),
  ];
  const groups = [
    { id: "g1", name: "Rojos" },
    { id: "g2", name: "Adultos" },
    { id: "g3", name: "Vacío" },
  ];
  const memberships = [
    { groupId: "g1", studentId: "a" },
    { groupId: "g1", studentId: "b" },
    { groupId: "g1", studentId: "d" },
    { groupId: "g2", studentId: "c" },
    { groupId: "g2", studentId: "e" },
    { groupId: "gX", studentId: "a" }, // grupo no visible: se ignora
    { groupId: "g1", studentId: "zz" }, // alumno no visible: se ignora
  ];

  const stats = buildStudentsStats({ students, groups, memberships, now });

  it("cuenta alumnos, grupos y tamaño de cada grupo", () => {
    expect(stats.totalStudents).toBe(5);
    expect(stats.groupCount).toBe(3);
    expect(stats.groupSizes.map((g) => [g.name, g.count])).toEqual([
      ["Rojos", 3],
      ["Adultos", 2],
      ["Vacío", 0],
    ]);
  });

  it("reparte por las etapas de la etiqueta de nivel", () => {
    const byId = Object.fromEntries(stats.levels.map((l) => [l.id, l.count]));
    expect(byId.descubrimiento).toBe(1);
    expect(byId.desarrollo).toBe(2);
    expect(byId.consolidacion).toBe(0);
    expect(byId.otros).toBe(1);
    expect(byId.sin_nivel).toBe(1);
    expect(stats.levels[0].label).toBe("Descubrimiento");
    expect(stats.levels.some((l) => l.id === "rendimiento")).toBe(false);
  });

  it("calcula la edad máxima y el reparto solo entre alumnos en grupos", () => {
    expect(stats.groupedStudents).toBe(5);
    expect(stats.oldest).toEqual({
      name: "Eva",
      age: 36,
      groupName: "Adultos",
    });
    expect(stats.groupedWithoutBirthDate).toBe(1);
    const band = (label: string) =>
      stats.ageBands.find((b) => b.label === label)?.count;
    expect(band("Menos de 7")).toBe(1);
    expect(band("7-8")).toBe(1);
    expect(band("17-18")).toBe(1);
    expect(band("19 o más")).toBe(1);
  });

  it("no cuenta en edades a quien no está en ningún grupo", () => {
    const solo = buildStudentsStats({
      students: [student({ id: "x", birthDate: "1950-01-01" })],
      groups: [],
      memberships: [],
      now,
    });
    expect(solo.oldest).toBeNull();
    expect(solo.groupedStudents).toBe(0);
  });

  it("agrupa procedencias sin distinguir mayúsculas ni tildes", () => {
    const origin = buildStudentsStats({
      students: [
        student({
          id: "1",
          locality: "La Laguna",
          localityLat: 28.48,
          localityLng: -16.31,
        }),
        student({
          id: "2",
          locality: " la  laguna ",
          localityLat: 28.5,
          localityLng: -16.3,
        }),
        student({
          id: "3",
          locality: "Tegueste",
          localityLat: 28.51,
          localityLng: -16.34,
        }),
        student({ id: "4", locality: "Sitio raro" }),
        student({ id: "5" }),
      ],
      groups: [],
      memberships: [],
      now,
    });
    expect(origin.origins.map((o) => [o.name, o.count])).toEqual([
      ["La Laguna", 2],
      ["Tegueste", 1],
    ]);
    expect(origin.origins[0].lat).toBeCloseTo(28.49);
    expect(origin.unlocatedStudents).toBe(1);
    expect(origin.withoutLocality).toBe(1);
  });
});

describe("geocodeLocality", () => {
  const ok = (body: unknown) =>
    (async () =>
      new Response(JSON.stringify(body), {
        status: 200,
      })) as unknown as typeof fetch;

  it("devuelve las coordenadas del primer resultado", async () => {
    const point = await geocodeLocality(
      "La Laguna",
      ok([{ lat: "28.4874", lon: "-16.3141" }])
    );
    expect(point).toEqual({ lat: 28.4874, lng: -16.3141 });
  });

  it("envía solo la localidad y se identifica con User-Agent", async () => {
    let called: URL | null = null;
    let headers: HeadersInit | undefined;
    const spy = (async (url: URL, init?: RequestInit) => {
      called = url;
      headers = init?.headers;
      return new Response("[]", { status: 200 });
    }) as unknown as typeof fetch;
    await geocodeLocality("Tegueste", spy);
    expect(called!.searchParams.get("q")).toBe("Tegueste");
    expect(called!.searchParams.get("countrycodes")).toBe("es");
    expect((headers as Record<string, string>)["User-Agent"]).toContain(
      "TenPlanner"
    );
  });

  it("devuelve null ante vacío, sin resultados, error o red caída", async () => {
    expect(await geocodeLocality("   ", ok([]))).toBeNull();
    expect(await geocodeLocality("Nada", ok([]))).toBeNull();
    expect(
      await geocodeLocality("Mal", ok([{ lat: "x", lon: "y" }]))
    ).toBeNull();
    const down = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await geocodeLocality("Caída", down)).toBeNull();
    const http500 = (async () =>
      new Response("", { status: 500 })) as unknown as typeof fetch;
    expect(await geocodeLocality("Error", http500)).toBeNull();
  });
});

describe("StudentsStatsPdf", () => {
  it("genera un PDF válido con y sin datos", async () => {
    const full = buildStudentsStats({
      now,
      students: [
        student({
          id: "a",
          playerLevel: "descubrimiento",
          birthDate: "2020-01-01",
          locality: "La Laguna",
          localityLat: 28.48,
          localityLng: -16.31,
        }),
      ],
      groups: [{ id: "g", name: "Rojos" }],
      memberships: [{ groupId: "g", studentId: "a" }],
    });
    const empty = buildStudentsStats({
      now,
      students: [],
      groups: [],
      memberships: [],
    });

    for (const stats of [full, empty]) {
      const element = createElement(StudentsStatsPdf, {
        scopeLabel: "Club de prueba",
        coachName: "David",
        generatedAt: now,
        stats,
      }) as ReactElement<DocumentProps>;
      const buffer = await renderToBuffer(element);
      expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    }
  });
});
