import { describe, expect, it } from "vitest";
import { embedPngText, readPngText } from "@/lib/png-text";

// PNG de 1×1 píxel.
const PNG_1X1 = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg=="
  ),
  (c) => c.charCodeAt(0)
);

describe("datos dentro del PNG", () => {
  it("guarda y recupera un texto, también con acentos y emojis", () => {
    const text = JSON.stringify({ t: "text", text: "Saque ñ 🎾" });
    const withData = embedPngText(PNG_1X1, "tenplanner-board", text);
    expect(readPngText(withData, "tenplanner-board")).toBe(text);
  });

  it("el PNG con datos sigue empezando igual y termina en IEND", () => {
    const withData = embedPngText(PNG_1X1, "k", "hola");
    expect(Array.from(withData.subarray(0, 8))).toEqual(
      Array.from(PNG_1X1.subarray(0, 8))
    );
    expect(withData.length).toBeGreaterThan(PNG_1X1.length);
    expect(Array.from(withData.subarray(-12, -8))).toEqual([0, 0, 0, 0]);
    expect(String.fromCharCode(...withData.subarray(-8, -4))).toBe("IEND");
  });

  it("devuelve null si el PNG no tiene ese dato o no es un PNG", () => {
    expect(readPngText(PNG_1X1, "tenplanner-board")).toBeNull();
    expect(readPngText(new Uint8Array([1, 2, 3]), "k")).toBeNull();
  });
});
