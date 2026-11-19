import { describe, expect, it } from "vitest";
import { qrMatrix, qrRuns } from "@/lib/tournaments/qr";

describe("qrMatrix / qrRuns", () => {
  it("genera una matriz cuadrada con los tres patrones de posición", () => {
    const m = qrMatrix("https://tenplanner.com/t/torneo-navidad-ab12cd");
    const n = m.length;
    expect(n).toBeGreaterThanOrEqual(21);
    expect(m.every((r) => r.length === n)).toBe(true);
    // Esquinas: fila superior de los patrones de 7 módulos, en negro.
    expect(m[0].slice(0, 7).every(Boolean)).toBe(true);
    expect(m[0].slice(n - 7).every(Boolean)).toBe(true);
    expect(m[n - 1].slice(0, 7).every(Boolean)).toBe(true);
  });

  it("los tramos cubren exactamente los módulos negros", () => {
    const m = qrMatrix("https://tenplanner.com/t/x");
    const dark = m.flat().filter(Boolean).length;
    const runs = qrRuns(m);
    expect(runs.reduce((s, [, , w]) => s + w, 0)).toBe(dark);
    for (const [x, y, w] of runs) {
      expect(m[y].slice(x, x + w).every(Boolean)).toBe(true);
    }
  });
});
