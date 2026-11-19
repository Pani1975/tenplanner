import { describe, expect, it } from "vitest";
import {
  addEntriesSchema,
  createTournamentSchema,
  matchResultSchema,
  updateEntrySchema,
  updateTournamentSchema,
} from "@/lib/tournaments/schemas";

const base = {
  name: "Torneo de Navidad",
  startDate: "2026-12-20",
  modality: "singles",
  format: "knockout",
};

describe("createTournamentSchema", () => {
  it("valores por defecto del marcador", () => {
    const r = createTournamentSchema.parse(base);
    expect(r).toMatchObject({
      bestOf: 3,
      gamesPerSet: 6,
      finalSet: "super_tiebreak",
      description: null,
    });
  });

  it("fechas incoherentes", () => {
    expect(
      createTournamentSchema.safeParse({ ...base, endDate: "2026-12-19" })
        .success
    ).toBe(false);
    expect(
      createTournamentSchema.safeParse({
        ...base,
        registrationDeadline: "2026-12-21T10:00:00+01:00",
      }).success
    ).toBe(false);
    expect(
      createTournamentSchema.safeParse({
        ...base,
        endDate: "2026-12-21",
        registrationDeadline: "2026-12-18T20:00:00+01:00",
      }).success
    ).toBe(true);
  });

  it("límites", () => {
    expect(
      createTournamentSchema.safeParse({ ...base, name: "ab" }).success
    ).toBe(false);
    expect(
      createTournamentSchema.safeParse({ ...base, maxEntries: 1 }).success
    ).toBe(false);
    expect(
      createTournamentSchema.safeParse({ ...base, bestOf: 2 }).success
    ).toBe(false);
    expect(
      createTournamentSchema.safeParse({ ...base, format: "swiss" }).success
    ).toBe(false);
  });
});

describe("updateTournamentSchema", () => {
  it("todo opcional, con estado", () => {
    expect(updateTournamentSchema.parse({ status: "open" })).toEqual({
      status: "open",
    });
    expect(updateTournamentSchema.safeParse({ status: "x" }).success).toBe(
      false
    );
  });
});

const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

describe("addEntriesSchema", () => {
  it("alumnos de la escuela", () => {
    const r = addEntriesSchema.parse({
      kind: "school",
      items: [{ studentId: uuid(1), groupId: uuid(2) }],
      consentDeclared: true,
    });
    expect(r.kind).toBe("school");
    expect(
      addEntriesSchema.safeParse({
        kind: "school",
        items: [],
        consentDeclared: true,
      }).success
    ).toBe(false);
  });

  it("externo adulto: necesita correo o teléfono", () => {
    const player = { firstName: "Ana", lastName: "Ruiz" };
    expect(
      addEntriesSchema.safeParse({
        kind: "manual",
        player,
        consentDeclared: true,
      }).success
    ).toBe(false);
    expect(
      addEntriesSchema.safeParse({
        kind: "manual",
        player: { ...player, phone: "600112233" },
        consentDeclared: true,
      }).success
    ).toBe(true);
  });

  it("externo menor: necesita nombre y contacto del tutor", () => {
    const player = {
      firstName: "Leo",
      lastName: "Ruiz",
      isMinor: true,
      email: "leo@x.com",
    };
    expect(
      addEntriesSchema.safeParse({
        kind: "manual",
        player,
        consentDeclared: false,
      }).success
    ).toBe(false);
    expect(
      addEntriesSchema.safeParse({
        kind: "manual",
        player: {
          ...player,
          guardianName: "Marta Ruiz",
          guardianEmail: "marta@x.com",
        },
        consentDeclared: false,
      }).success
    ).toBe(true);
  });

  it("apellidos obligatorios en externos (para las iniciales)", () => {
    expect(
      addEntriesSchema.safeParse({
        kind: "manual",
        player: { firstName: "Ana", lastName: "", phone: "600112233" },
        consentDeclared: true,
      }).success
    ).toBe(false);
  });
});

describe("updateEntrySchema / matchResultSchema", () => {
  it("acciones de inscripción", () => {
    expect(updateEntrySchema.safeParse({ action: "cancel" }).success).toBe(
      true
    );
    expect(
      updateEntrySchema.safeParse({ action: "seed", seed: 1 }).success
    ).toBe(true);
    expect(updateEntrySchema.safeParse({ action: "delete" }).success).toBe(
      false
    );
  });

  it("marcador estructurado, no texto libre", () => {
    expect(
      matchResultSchema.safeParse({
        resultType: "normal",
        score: {
          sets: [
            { a: 6, b: 4 },
            { a: 6, b: 3 },
          ],
        },
      }).success
    ).toBe(true);
    expect(
      matchResultSchema.safeParse({ resultType: "normal", score: "6-4 6-3" })
        .success
    ).toBe(false);
    expect(
      matchResultSchema.safeParse({
        resultType: "normal",
        score: { sets: [{ a: 6.5, b: 4 }] },
      }).success
    ).toBe(false);
  });
});
