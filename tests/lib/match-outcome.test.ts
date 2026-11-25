import { describe, expect, it } from "vitest";
import { matchOutcome } from "@/lib/matches/outcome";

describe("matchOutcome", () => {
  it("6-4 6-4 es victoria y 4-6 4-6 es derrota", () => {
    expect(matchOutcome("6-4 6-4")).toBe("victoria");
    expect(matchOutcome("4-6 4-6")).toBe("derrota");
  });

  it("gana quien se lleva más sets", () => {
    expect(matchOutcome("6-4 3-6 10-8")).toBe("victoria");
    expect(matchOutcome("6-4 3-6 8-10")).toBe("derrota");
    expect(matchOutcome("0-6 6-0 7-5")).toBe("victoria");
  });

  it("el desempate entre paréntesis no cambia el set", () => {
    expect(matchOutcome("7-6(5) 6-7(3) 4-6")).toBe("derrota");
    expect(matchOutcome("7-6(5) 7-6(2)")).toBe("victoria");
  });

  it("con los sets empatados o sin resultado no se sabe", () => {
    expect(matchOutcome("6-4 4-6")).toBeNull();
    expect(matchOutcome("")).toBeNull();
    expect(matchOutcome(null)).toBeNull();
    expect(matchOutcome("ganado")).toBeNull();
  });
});
