import { describe, expect, it } from "vitest";
import {
  objectiveScopeFor,
  resolveObjectives,
  type RawObjective,
  type RawOverride,
  type StudentScopeContext,
} from "@/lib/objectives-resolve";

const CLUB = "club-1";
const OTHER_CLUB = "club-2";
const COACH = "coach-1";
const STUDENT = "student-1";

const clubStudent: StudentScopeContext = {
  studentId: STUDENT,
  clubId: CLUB,
  coachId: COACH,
};
const particular: StudentScopeContext = {
  studentId: STUDENT,
  clubId: null,
  coachId: COACH,
};

function obj(id: string, extra: Partial<RawObjective> = {}): RawObjective {
  return {
    id,
    code: id,
    ball: "roja",
    aspect: "tecnico",
    block: "Derecha",
    title: `Título ${id}`,
    criterion: `Criterio ${id}`,
    source: "desglose",
    sortOrder: 1,
    isActive: true,
    clubId: null,
    coachId: null,
    studentId: null,
    ...extra,
  };
}

function ov(objectiveId: string, extra: Partial<RawOverride>): RawOverride {
  return {
    objectiveId,
    clubId: null,
    coachId: null,
    studentId: null,
    hidden: null,
    title: null,
    criterion: null,
    ...extra,
  };
}

const noMarks = new Map<string, string | Date | null>();

describe("objectiveScopeFor", () => {
  it("el catálogo base aplica a todos", () => {
    expect(objectiveScopeFor(obj("a"), clubStudent)).toBe("base");
    expect(objectiveScopeFor(obj("a"), particular)).toBe("base");
  });

  it("un objetivo de club solo aplica a alumnos de ese club", () => {
    const o = obj("a", { clubId: CLUB });
    expect(objectiveScopeFor(o, clubStudent)).toBe("club");
    expect(objectiveScopeFor(o, particular)).toBeNull();
    expect(
      objectiveScopeFor(obj("b", { clubId: OTHER_CLUB }), clubStudent)
    ).toBeNull();
  });

  it("un objetivo de monitor solo aplica a sus alumnos particulares", () => {
    const o = obj("a", { coachId: COACH });
    expect(objectiveScopeFor(o, particular)).toBe("coach");
    expect(objectiveScopeFor(o, clubStudent)).toBeNull();
    expect(
      objectiveScopeFor(obj("b", { coachId: "otro" }), particular)
    ).toBeNull();
  });

  it("un objetivo de alumno solo aplica a ese alumno", () => {
    expect(
      objectiveScopeFor(obj("a", { studentId: STUDENT }), clubStudent)
    ).toBe("student");
    expect(
      objectiveScopeFor(obj("b", { studentId: "otro" }), clubStudent)
    ).toBeNull();
  });
});

describe("resolveObjectives", () => {
  it("combina base y propios, y descarta inactivos y ajenos", () => {
    const items = resolveObjectives(
      [
        obj("base"),
        obj("club", { clubId: CLUB }),
        obj("ajeno", { clubId: OTHER_CLUB }),
        obj("inactivo", { isActive: false }),
      ],
      [],
      noMarks,
      clubStudent
    );
    expect(items.map((i) => i.id)).toEqual(["base", "club"]);
    expect(items.map((i) => i.scope)).toEqual(["base", "club"]);
  });

  it("aplica el ajuste del club y el del alumno gana sobre el del club", () => {
    const items = resolveObjectives(
      [obj("a")],
      [
        ov("a", { clubId: CLUB, title: "Del club", criterion: "Crit club" }),
        ov("a", { studentId: STUDENT, title: "Del alumno" }),
      ],
      noMarks,
      clubStudent
    );
    expect(items[0].title).toBe("Del alumno");
    // el criterio no lo toca el alumno: sigue el del club
    expect(items[0].criterion).toBe("Crit club");
    expect(items[0].overriddenAt.sort()).toEqual(["club", "student"]);
  });

  it("ignora ajustes de otros clubs, monitores o alumnos", () => {
    const items = resolveObjectives(
      [obj("a")],
      [
        ov("a", { clubId: OTHER_CLUB, title: "Otro club" }),
        ov("a", { studentId: "otro", title: "Otro alumno" }),
        ov("a", { coachId: COACH, title: "Monitor" }), // el alumno tiene club
      ],
      noMarks,
      clubStudent
    );
    expect(items[0].title).toBe("Título a");
    expect(items[0].overriddenAt).toEqual([]);
  });

  it("el ajuste del monitor aplica a sus alumnos particulares", () => {
    const items = resolveObjectives(
      [obj("a")],
      [ov("a", { coachId: COACH, title: "Mío" })],
      noMarks,
      particular
    );
    expect(items[0].title).toBe("Mío");
    expect(items[0].overriddenAt).toEqual(["coach"]);
  });

  it("oculta por club y el alumno puede volver a mostrarlo", () => {
    const hiddenByClub = resolveObjectives(
      [obj("a")],
      [ov("a", { clubId: CLUB, hidden: true })],
      noMarks,
      clubStudent
    );
    expect(hiddenByClub[0].hidden).toBe(true);

    const reshown = resolveObjectives(
      [obj("a")],
      [
        ov("a", { clubId: CLUB, hidden: true }),
        ov("a", { studentId: STUDENT, hidden: false }),
      ],
      noMarks,
      clubStudent
    );
    expect(reshown[0].hidden).toBe(false);
  });

  it("un criterio vacío en un ajuste sustituye al original", () => {
    const items = resolveObjectives(
      [obj("a")],
      [ov("a", { clubId: CLUB, criterion: "" })],
      noMarks,
      clubStudent
    );
    expect(items[0].criterion).toBe("");
  });

  it("refleja las marcas del alumno", () => {
    const marks = new Map<string, string | Date | null>([
      ["a", new Date("2026-09-01T10:00:00Z")],
    ]);
    const items = resolveObjectives(
      [obj("a"), obj("b")],
      [],
      marks,
      clubStudent
    );
    expect(items[0].achieved).toBe(true);
    expect(items[0].achievedAt).toBe("2026-09-01T10:00:00.000Z");
    expect(items[1].achieved).toBe(false);
  });
});
