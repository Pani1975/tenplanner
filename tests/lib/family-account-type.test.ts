import { describe, expect, it } from "vitest";
import { isFamilyAccountType } from "@/lib/family-account";

describe("isFamilyAccountType", () => {
  it("reconoce las cuentas de familia y de jugador", () => {
    expect(isFamilyAccountType({ account_type: "familia" })).toBe(true);
    expect(isFamilyAccountType({ account_type: "jugador" })).toBe(true);
  });
  it("no confunde monitores, clubes ni valores inesperados", () => {
    expect(isFamilyAccountType({ account_type: "monitor" })).toBe(false);
    expect(isFamilyAccountType({ account_type: "FAMILIA " })).toBe(false);
    expect(isFamilyAccountType({ role: "coach" })).toBe(false);
    expect(isFamilyAccountType(null)).toBe(false);
    expect(isFamilyAccountType(undefined)).toBe(false);
  });
});
