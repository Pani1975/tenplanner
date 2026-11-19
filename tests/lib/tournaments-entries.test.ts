import { describe, expect, it } from "vitest";
import {
  allocateNew,
  findDuplicates,
  isMinorStudent,
  normalizeEmail,
  normalizePhone,
  promoteFromWaitlist,
  spotsTaken,
  waitlistPosition,
  type EntryStatus,
  type QueueEntry,
} from "@/lib/tournaments/entries";

const st = (...s: EntryStatus[]) => s.map((status) => ({ status }));

describe("allocateNew", () => {
  it("rellena plazas y el resto a lista de espera", () => {
    expect(
      allocateNew(st("confirmed", "confirmed"), 4, [
        { hasConsent: true },
        { hasConsent: false },
        { hasConsent: true },
      ])
    ).toEqual(["confirmed", "pending", "waitlist"]);
  });

  it("las pendientes ocupan plaza; las canceladas y en espera no", () => {
    expect(
      spotsTaken(st("pending", "confirmed", "cancelled", "waitlist"))
    ).toBe(2);
    expect(
      allocateNew(st("pending", "cancelled"), 2, [{ hasConsent: true }])
    ).toEqual(["confirmed"]);
  });

  it("sin límite de plazas", () => {
    expect(
      allocateNew(st("confirmed"), null, [
        { hasConsent: true },
        { hasConsent: true },
      ])
    ).toEqual(["confirmed", "confirmed"]);
  });

  it("si ya hay lista de espera nadie se la salta, aunque quede hueco", () => {
    expect(
      allocateNew(st("confirmed", "waitlist"), 4, [{ hasConsent: true }])
    ).toEqual(["waitlist"]);
  });

  it("cupo ya superado (p. ej. tras bajar plazas)", () => {
    expect(
      allocateNew(st("confirmed", "confirmed", "confirmed"), 2, [
        { hasConsent: true },
      ])
    ).toEqual(["waitlist"]);
  });
});

const q = (
  id: string,
  status: EntryStatus,
  minute: number,
  hasConsent = true
): QueueEntry => ({
  id,
  status,
  createdAt: new Date(Date.UTC(2026, 10, 19, 10, minute)),
  hasConsent,
});

describe("promoteFromWaitlist", () => {
  it("al cancelar, sube el primero de la lista por orden de llegada", () => {
    const entries = [
      q("a", "confirmed", 0),
      q("b", "cancelled", 1),
      q("w2", "waitlist", 5),
      q("w1", "waitlist", 3, false),
    ];
    expect(promoteFromWaitlist(entries, 2)).toEqual([
      { id: "w1", status: "pending" },
    ]);
  });

  it("sin plazas libres no sube nadie", () => {
    expect(
      promoteFromWaitlist([q("a", "confirmed", 0), q("w", "waitlist", 1)], 1)
    ).toEqual([]);
  });

  it("al ampliar plazas suben varios", () => {
    const entries = [
      q("a", "confirmed", 0),
      q("w1", "waitlist", 1),
      q("w2", "waitlist", 2),
      q("w3", "waitlist", 3),
    ];
    expect(promoteFromWaitlist(entries, 3).map((p) => p.id)).toEqual([
      "w1",
      "w2",
    ]);
    expect(promoteFromWaitlist(entries, null).map((p) => p.id)).toEqual([
      "w1",
      "w2",
      "w3",
    ]);
  });

  it("posición en la lista de espera", () => {
    const entries = [
      q("w2", "waitlist", 5),
      q("w1", "waitlist", 3),
      q("a", "confirmed", 0),
    ];
    expect(waitlistPosition(entries, "w1")).toBe(1);
    expect(waitlistPosition(entries, "w2")).toBe(2);
    expect(waitlistPosition(entries, "a")).toBeNull();
  });
});

describe("normalización", () => {
  it("correo", () => {
    expect(normalizeEmail("  Ana@Ejemplo.COM ")).toBe("ana@ejemplo.com");
    expect(normalizeEmail("  ")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });

  it("teléfono: mismos números en distintos formatos coinciden", () => {
    const forms = [
      "600 11 22 33",
      "+34 600112233",
      "0034600112233",
      "600-112-233",
    ];
    expect(new Set(forms.map(normalizePhone))).toEqual(
      new Set(["+34600112233"])
    );
    expect(normalizePhone("+44 7700 900123")).toBe("+447700900123");
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("abc")).toBeNull();
  });
});

describe("findDuplicates", () => {
  it("alumno ya inscrito, como jugador o como pareja", () => {
    const existing = [
      { status: "confirmed" as const, studentId: "s1", partnerStudentId: "s2" },
    ];
    expect(
      findDuplicates(existing, [
        { studentId: "s2" },
        { studentId: "s3", partnerStudentId: "s1" },
        { studentId: "s4" },
      ])
    ).toEqual([0, 1]);
  });

  it("las canceladas no cuentan", () => {
    expect(
      findDuplicates(
        [{ status: "cancelled", studentId: "s1" }],
        [{ studentId: "s1" }]
      )
    ).toEqual([]);
  });

  it("duplicados dentro de la misma selección (p. ej. alumno en dos grupos)", () => {
    expect(
      findDuplicates(
        [],
        [{ studentId: "s1" }, { studentId: "s2" }, { studentId: "s1" }]
      )
    ).toEqual([2]);
  });

  it("enlace: mismo correo o teléfono con otro formato", () => {
    const existing = [
      { status: "waitlist" as const, email: "ana@x.com", phone: "600112233" },
    ];
    expect(
      findDuplicates(existing, [
        { email: "ANA@x.com " },
        { phone: "+34 600 11 22 33" },
        { email: "otra@x.com" },
      ])
    ).toEqual([0, 1]);
  });

  it("la pareja no puede ser el propio jugador", () => {
    expect(
      findDuplicates([], [{ studentId: "s1", partnerStudentId: "s1" }])
    ).toEqual([0]);
    expect(
      findDuplicates([], [{ email: "a@x.com", partnerEmail: "A@x.com" }])
    ).toEqual([0]);
  });
});

describe("isMinorStudent", () => {
  const today = new Date(Date.UTC(2026, 10, 19));
  it("menor, mayor y sin fecha (cuenta como menor)", () => {
    expect(isMinorStudent("2012-05-01", today)).toBe(true);
    expect(isMinorStudent("2008-11-19", today)).toBe(false);
    expect(isMinorStudent("2008-11-20", today)).toBe(true);
    expect(isMinorStudent(null, today)).toBe(true);
  });
});
