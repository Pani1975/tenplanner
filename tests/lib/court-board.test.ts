import { describe, expect, it } from "vitest";
import {
  distanceToShape,
  drawingDataUrl,
  hitTest,
  isDrawingUrl,
  parseBoardDoc,
  translateShape,
  type Shape,
} from "@/lib/court-board";

describe("pizarra de pista", () => {
  it("reconoce los dibujos por su carpeta y extensión", () => {
    expect(isDrawingUrl("https://x.co/resources/u1/drawings/123.png")).toBe(
      true
    );
    expect(isDrawingUrl("https://x.co/resources/u1/img-123.png")).toBe(false);
    expect(isDrawingUrl(null)).toBe(false);
  });

  it("deduce la URL de los datos editables", () => {
    expect(drawingDataUrl("https://x.co/u1/drawings/123.png")).toBe(
      "https://x.co/u1/drawings/123.json"
    );
  });

  it("valida los datos cargados", () => {
    expect(parseBoardDoc(null)).toBeNull();
    expect(parseBoardDoc({ shapes: "no" })).toBeNull();
    expect(parseBoardDoc({ court: "half", shapes: [] })?.court).toBe("half");
    expect(parseBoardDoc({ shapes: [] })?.court).toBe("full");
  });

  it("mide la distancia a una flecha y a un punto", () => {
    const arrow: Shape = {
      t: "arrow",
      a: [0, 0],
      b: [100, 0],
      dashed: false,
    };
    expect(distanceToShape([50, 10], arrow)).toBe(10);
    expect(distanceToShape([130, 0], arrow)).toBe(30);
    expect(distanceToShape([3, 4], { t: "cone", at: [0, 0] })).toBe(5);
  });
});

describe("mover figuras", () => {
  it("elige la figura de arriba y prefiere jugadores a líneas", () => {
    const shapes: Shape[] = [
      { t: "arrow", a: [0, 100], b: [200, 100], dashed: false },
      { t: "alumno", at: [100, 100], n: 1 },
    ];
    expect(hitTest([105, 102], shapes)).toEqual({ index: 1, part: "all" });
    expect(hitTest([50, 100], shapes)).toEqual({ index: 0, part: "all" });
    expect(hitTest([300, 300], shapes)).toBeNull();
  });

  it("agarra un extremo de la flecha para girarla", () => {
    const shapes: Shape[] = [
      { t: "arrow", a: [50, 50], b: [250, 50], dashed: true },
    ];
    expect(hitTest([248, 52], shapes)).toEqual({ index: 0, part: "b" });
    expect(hitTest([52, 48], shapes)).toEqual({ index: 0, part: "a" });
  });

  it("mueve un jugador sin sacarlo del lienzo", () => {
    const moved = translateShape({ t: "alumno", at: [390, 10], n: 1 }, 50, -50);
    expect(moved).toEqual({ t: "alumno", at: [400, 0], n: 1 });
  });

  it("mueve una flecha entera sin deformarla y un solo extremo si se pide", () => {
    const arrow: Shape = {
      t: "arrow",
      a: [10, 10],
      b: [110, 10],
      dashed: false,
    };
    expect(translateShape(arrow, 20, 5)).toEqual({
      ...arrow,
      a: [30, 15],
      b: [130, 15],
    });
    // Se frena en el borde manteniendo la forma.
    expect(translateShape(arrow, -50, 0)).toEqual({
      ...arrow,
      a: [0, 10],
      b: [100, 10],
    });
    expect(translateShape(arrow, 0, 40, "b")).toEqual({
      ...arrow,
      b: [110, 50],
    });
  });
});
