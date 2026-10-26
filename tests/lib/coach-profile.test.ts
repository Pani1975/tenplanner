import { describe, expect, it } from "vitest";
import {
  coachProfileLinkRequestSchema,
  coachProfileSchema,
  fallbackNameFromEmail,
  formatExperienceRange,
  isAllSelected,
  normalizeAvailability,
  summarizeAvailability,
  toggleAll,
  toggleBlock,
  toggleDay,
} from "@/lib/coach-profile";

const valid = {
  fullName: "Ángel Pérez García",
  email: "  Angel@Example.COM ",
  phone: "+34 600 123 456",
};

describe("coachProfileSchema", () => {
  it("acepta solo los tres datos obligatorios", () => {
    const result = coachProfileSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.email).toBe("angel@example.com");
    expect(result.data.academicTraining).toBeNull();
    expect(result.data.tennisTraining).toBeNull();
    expect(result.data.availability).toBeNull();
    expect(result.data.startedTeachingYear).toBeNull();
    expect(result.data.experience).toEqual([]);
  });

  it("exige nombre y apellidos", () => {
    const result = coachProfileSchema.safeParse({
      ...valid,
      fullName: "Ángel",
    });
    expect(result.success).toBe(false);
  });

  it("exige email válido y teléfono", () => {
    expect(
      coachProfileSchema.safeParse({ ...valid, email: "no-es-email" }).success
    ).toBe(false);
    expect(coachProfileSchema.safeParse({ ...valid, phone: "" }).success).toBe(
      false
    );
  });

  it("valida el formato del teléfono", () => {
    for (const phone of ["600123456", "+34 600 12 34 56", "(928) 123-456"]) {
      expect(coachProfileSchema.safeParse({ ...valid, phone }).success).toBe(
        true
      );
    }
    for (const phone of ["123", "abcdefghij", "600-123-456-789-0123"]) {
      expect(coachProfileSchema.safeParse({ ...valid, phone }).success).toBe(
        false
      );
    }
  });

  it("convierte textos vacíos de los opcionales en null", () => {
    const result = coachProfileSchema.safeParse({
      ...valid,
      academicTraining: "   ",
      tennisTraining: "Nivel 1 RFET",
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.academicTraining).toBeNull();
    expect(result.data.tennisTraining).toBe("Nivel 1 RFET");
  });

  it("rechaza años futuros o anteriores a 1950", () => {
    const next = new Date().getFullYear() + 1;
    expect(
      coachProfileSchema.safeParse({ ...valid, startedTeachingYear: next })
        .success
    ).toBe(false);
    expect(
      coachProfileSchema.safeParse({ ...valid, startedTeachingYear: 1900 })
        .success
    ).toBe(false);
    expect(
      coachProfileSchema.safeParse({ ...valid, startedTeachingYear: 2015 })
        .success
    ).toBe(true);
  });

  describe("experiencia", () => {
    it("admite una experiencia hasta la actualidad, con empresa y rol opcionales", () => {
      const result = coachProfileSchema.safeParse({
        ...valid,
        experience: [
          { startYear: 2018, endYear: null, company: "CT Tenerife", role: "" },
          { startYear: 2012, endYear: 2017, company: null, role: null },
        ],
      });
      expect(result.success).toBe(true);
      if (!result.success) return;
      expect(result.data.experience[0]).toEqual({
        startYear: 2018,
        endYear: null,
        company: "CT Tenerife",
        role: null,
      });
    });

    it("rechaza finalización anterior al comienzo", () => {
      const result = coachProfileSchema.safeParse({
        ...valid,
        experience: [
          { startYear: 2018, endYear: 2015, company: null, role: null },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("rechaza una experiencia sin año de comienzo", () => {
      const result = coachProfileSchema.safeParse({
        ...valid,
        experience: [{ endYear: null, company: "X" }],
      });
      expect(result.success).toBe(false);
    });
  });

  it("normaliza la disponibilidad y descarta días vacíos", () => {
    const result = coachProfileSchema.safeParse({
      ...valid,
      availability: { martes: ["tarde", "manana", "tarde"], lunes: [] },
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.availability).toEqual({ martes: ["manana", "tarde"] });
  });

  it("rechaza días o bloques desconocidos", () => {
    expect(
      coachProfileSchema.safeParse({
        ...valid,
        availability: { festivo: ["tarde"] },
      }).success
    ).toBe(false);
    expect(
      coachProfileSchema.safeParse({
        ...valid,
        availability: { lunes: ["noche"] },
      }).success
    ).toBe(false);
  });
});

describe("coachProfileLinkRequestSchema", () => {
  it("solo pide nombre (aunque sea a medias) y email", () => {
    const result = coachProfileLinkRequestSchema.safeParse({
      fullName: "Ángel",
      email: "ANGEL@example.com",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.email).toBe("angel@example.com");
  });
});

describe("disponibilidad", () => {
  it("'Todos' marca todo y vuelve a quitarlo", () => {
    const all = toggleAll({});
    expect(isAllSelected(all)).toBe(true);
    expect(toggleAll(all)).toEqual({});
  });

  it("'Todos' completa lo que falta si había algo marcado", () => {
    const partial = toggleBlock({}, "lunes", "tarde");
    expect(isAllSelected(partial)).toBe(false);
    expect(isAllSelected(toggleAll(partial))).toBe(true);
  });

  it("marca un día entero y lo desmarca", () => {
    const day = toggleDay({}, "sabado");
    expect(day.sabado).toEqual(["manana", "mediodia", "tarde"]);
    expect(toggleDay(day, "sabado").sabado).toEqual([]);
  });

  it("alterna un bloque conservando el orden", () => {
    let av = toggleBlock({}, "viernes", "tarde");
    av = toggleBlock(av, "viernes", "manana");
    expect(av.viernes).toEqual(["manana", "tarde"]);
    av = toggleBlock(av, "viernes", "tarde");
    expect(av.viernes).toEqual(["manana"]);
  });

  it("normalizeAvailability devuelve null si no hay nada", () => {
    expect(normalizeAvailability({})).toBeNull();
    expect(normalizeAvailability({ lunes: [] })).toBeNull();
    expect(normalizeAvailability(null)).toBeNull();
  });

  it("resume en texto legible", () => {
    expect(
      summarizeAvailability({
        lunes: ["manana", "mediodia", "tarde"],
        miercoles: ["manana", "tarde"],
        domingo: ["mediodia"],
      })
    ).toEqual([
      "Lunes: todo el día",
      "Miércoles: mañana y tarde",
      "Domingo: mediodía",
    ]);
    expect(summarizeAvailability(null)).toEqual([]);
  });
});

describe("formatExperienceRange", () => {
  it("muestra 'actualidad' cuando no hay año de finalización", () => {
    expect(formatExperienceRange(2018, null)).toBe("2018 – actualidad");
    expect(formatExperienceRange(2012, 2017)).toBe("2012 – 2017");
  });
});

describe("fallbackNameFromEmail", () => {
  it("usa lo anterior a la arroba", () => {
    expect(fallbackNameFromEmail("angel.perez@club.es")).toBe("angel.perez");
  });

  it("si no hay arroba, devuelve el texto tal cual", () => {
    expect(fallbackNameFromEmail("sin-arroba")).toBe("sin-arroba");
  });
});
