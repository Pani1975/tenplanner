import { describe, expect, it } from "vitest";
import { isAdult } from "@/lib/age";

const today = new Date("2026-10-17T12:00:00Z");

describe("isAdult", () => {
  it("sin fecha de nacimiento se trata como menor", () => {
    expect(isAdult(null, today)).toBe(false);
  });
  it("cumple 18 hoy → mayor", () => {
    expect(isAdult("2008-10-17", today)).toBe(true);
  });
  it("cumple 18 mañana → menor", () => {
    expect(isAdult("2008-10-18", today)).toBe(false);
  });
  it("niño de 11 años → menor", () => {
    expect(isAdult("2015-03-01", today)).toBe(false);
  });
  it("adulto → mayor", () => {
    expect(isAdult("1990-05-05", today)).toBe(true);
  });
  it("fecha no válida → menor", () => {
    expect(isAdult("no-es-fecha", today)).toBe(false);
  });
});
