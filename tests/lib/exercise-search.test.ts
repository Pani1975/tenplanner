import { describe, expect, it } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import {
  exerciseSearchCondition,
  normalizeSearchText,
  searchVariants,
  singularize,
  tokenizeSearch,
} from "@/lib/exercises/search";

describe("normalizeSearchText", () => {
  it("quita tildes, mayúsculas y signos", () => {
    expect(normalizeSearchText("  Revés ¡Aproximación!  ")).toBe(
      "reves aproximacion"
    );
    expect(normalizeSearchText("Niño")).toBe("nino");
  });
});

describe("tokenizeSearch", () => {
  it("separa palabras y quita las vacías", () => {
    expect(tokenizeSearch("Vuelta a la calma")).toEqual(["vuelta", "calma"]);
    expect(tokenizeSearch("dejada  globo dejada")).toEqual(["dejada", "globo"]);
  });

  it("si solo hay palabras vacías, las busca tal cual", () => {
    expect(tokenizeSearch("de la")).toEqual(["de", "la"]);
  });

  it("una búsqueda vacía no da palabras", () => {
    expect(tokenizeSearch("  ¿? ")).toEqual([]);
  });
});

describe("singularize", () => {
  it("quita el plural", () => {
    expect(singularize("voleas")).toBe("volea");
    expect(singularize("reveses")).toBe("reves");
    expect(singularize("golpes")).toBe("golp");
    expect(singularize("paredes")).toBe("pared");
  });

  it("no toca palabras cortas ni números", () => {
    expect(singularize("reves")).toBe("reve");
    expect(singularize("tres")).toBe("tre");
    expect(singularize("dos")).toBe("dos");
    expect(singularize("10")).toBe("10");
  });
});

describe("searchVariants", () => {
  it("añade sinónimos", () => {
    expect(searchVariants("smash").sort()).toEqual(["remate", "smash"]);
    expect(searchVariants("drive")).toContain("derecha");
    expect(searchVariants("servicio")).toContain("saque");
    expect(searchVariants("cancha")).toContain("pista");
  });

  it("encuentra sinónimos también en plural", () => {
    expect(searchVariants("smashes")).toContain("remate");
  });

  it("sin sinónimos, solo la raíz", () => {
    expect(searchVariants("voleas")).toContain("volea");
    expect(searchVariants("coordinacion")).toEqual(["coordinacion"]);
  });
});

describe("exerciseSearchCondition", () => {
  const dialect = new PgDialect();

  it("sin palabras no filtra", () => {
    expect(exerciseSearchCondition("   ")).toBeUndefined();
  });

  it("exige todas las palabras, cada una con sus variantes", () => {
    const cond = exerciseSearchCondition("dejada smash");
    expect(cond).toBeDefined();
    const { sql, params } = dialect.sqlToQuery(cond!);
    expect(sql).toContain(" and ");
    expect(params).toEqual(
      expect.arrayContaining(["%dejada%", "%drop%", "%remate%", "%smash%"])
    );
  });
});
