import { describe, expect, it } from "vitest";
import {
  normalizeSearchText,
  parseExerciseSearch,
  stemSearchWord,
} from "@/lib/exercises/search";

describe("normalizeSearchText", () => {
  it("quita tildes, mayúsculas y signos", () => {
    expect(normalizeSearchText("¡Revés CRUZADO!")).toBe("reves cruzado");
    expect(normalizeSearchText("Aproximación/Coordinación")).toBe(
      "aproximacion coordinacion"
    );
    expect(normalizeSearchText("niño")).toBe("nino");
  });
});

describe("stemSearchWord", () => {
  it("reduce plurales a una raíz que encuentra singular y plural", () => {
    expect(stemSearchWord("voleas")).toBe("volea");
    expect(stemSearchWord("globos")).toBe("globo");
    expect(stemSearchWord("reveses")).toBe("reves");
    expect(stemSearchWord("aproximaciones")).toBe("aproximacion");
    // "reves" ya es singular; "reve" encontraría también "breve".
    expect(stemSearchWord("reves")).toBe("reves");
    expect(stemSearchWord("tenis")).toBe("tenis");
  });

  it("no toca palabras cortas", () => {
    expect(stemSearchWord("dos")).toBe("dos");
    expect(stemSearchWord("red")).toBe("red");
  });
});

describe("parseExerciseSearch", () => {
  it("separa palabras (AND) y quita palabras vacías", () => {
    expect(parseExerciseSearch("dejada globo")).toEqual([
      ["dejada"],
      ["globo"],
    ]);
    expect(parseExerciseSearch("cesta de la volea")).toEqual([
      ["cesta", "canasto", "cesto"],
      ["volea"],
    ]);
  });

  it("añade sinónimos en las dos direcciones", () => {
    expect(parseExerciseSearch("smash")).toEqual([["smash", "remate"]]);
    // "remat" es subcadena de "remate" y "remates".
    expect(parseExerciseSearch("remates")).toEqual([["remat", "smash"]]);
    expect(parseExerciseSearch("cestos")).toEqual([
      ["cesto", "cesta", "canasto"],
    ]);
    expect(parseExerciseSearch("Servicio")).toEqual([["servicio", "saque"]]);
    expect(parseExerciseSearch("drive")).toEqual([["drive", "derecha"]]);
  });

  it("solo produce letras, cifras y guiones (nada de comodines LIKE)", () => {
    const all = parseExerciseSearch("50% _x_ \\ calentamiento").flat();
    for (const v of all) expect(v).toMatch(/^[a-z0-9-]+$/);
  });

  it("devuelve vacío si no queda ninguna palabra útil", () => {
    expect(parseExerciseSearch("  de la  ")).toEqual([]);
    expect(parseExerciseSearch("¿?")).toEqual([]);
  });
});
