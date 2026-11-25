import { describe, expect, it } from "vitest";
import { playerCategory } from "@/lib/players/category";
import { slugBase, validateProfile } from "@/lib/players/profile";

const TODAY = "2026-11-21";

describe("playerCategory (edad que se cumple en el año)", () => {
  const cat = (birthYear: number) => playerCategory(`${birthYear}-06-15`, 2026);
  it("asigna cada tramo", () => {
    expect(cat(2018)).toBe("Benjamín"); // 8
    expect(cat(2016)).toBe("Benjamín"); // 10
    expect(cat(2015)).toBe("Alevín"); // 11
    expect(cat(2014)).toBe("Alevín"); // 12
    expect(cat(2013)).toBe("Infantil"); // 13
    expect(cat(2011)).toBe("Cadete"); // 15
    expect(cat(2009)).toBe("Junior"); // 17
    expect(cat(2008)).toBe("Junior"); // 18
    expect(cat(2007)).toBe("Absoluto"); // 19
    expect(cat(1992)).toBe("Absoluto"); // 34
    expect(cat(1991)).toBe("+35"); // 35
    expect(cat(1987)).toBe("+35"); // 39
    expect(cat(1986)).toBe("+40"); // 40
    expect(cat(1972)).toBe("+50"); // 54
    expect(cat(1971)).toBe("+55"); // 55
    expect(cat(1966)).toBe("+60"); // 60
    expect(cat(1940)).toBe("+60"); // 86
  });
  it("usa el año, no el día de nacimiento", () => {
    expect(playerCategory("2016-12-31", 2026)).toBe("Benjamín");
    expect(playerCategory("2015-01-01", 2026)).toBe("Alevín");
  });
  it("sin fecha no hay categoría", () => {
    expect(playerCategory(null)).toBeNull();
    expect(playerCategory("")).toBeNull();
  });
});

describe("validateProfile", () => {
  const base = { firstName: "Ana", lastName: "García" };

  it("exige nombre y apellidos", () => {
    const r = validateProfile({}, TODAY);
    expect(!r.ok && r.errors.firstName && r.errors.lastName).toBeTruthy();
  });

  it("los opcionales vacíos quedan a null", () => {
    const r = validateProfile(base, TODAY);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.clubName).toBeNull();
      expect(r.data.startedAge).toBeNull();
      expect(r.data.isPublic).toBe(false);
    }
  });

  it("valida mano y edad de inicio", () => {
    const r = validateProfile(
      { ...base, dominantHand: "ambas", startedAge: "1" },
      TODAY
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errors.dominantHand).toBeDefined();
      expect(r.errors.startedAge).toBeDefined();
    }
  });

  it("perfil público: exige fecha de nacimiento", () => {
    const r = validateProfile({ ...base, isPublic: true }, TODAY);
    expect(!r.ok && r.errors.isPublic).toMatch(/fecha de nacimiento/);
  });

  it("perfil público: un menor no puede", () => {
    const menor = validateProfile(
      { ...base, isPublic: true, birthDate: "2008-11-22" },
      TODAY
    );
    expect(!menor.ok && menor.errors.isPublic).toMatch(/menores/);

    const adulto = validateProfile(
      { ...base, isPublic: true, birthDate: "2008-11-21" },
      TODAY
    );
    expect(adulto.ok).toBe(true);
  });

  it("no admite fecha de nacimiento futura", () => {
    const r = validateProfile({ ...base, birthDate: "2027-01-01" }, TODAY);
    expect(!r.ok && r.errors.birthDate).toBeTruthy();
  });
});

describe("slugBase", () => {
  it("quita acentos y símbolos", () => {
    expect(slugBase("Ana María", "Núñez-López")).toBe("ana-maria-nunez-lopez");
    expect(slugBase("!!", "??")).toBe("jugador");
  });
});
