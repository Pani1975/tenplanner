// Matriz de un código QR (sin dibujar), para pintarlo como vector en el PDF.

import QRCode from "qrcode";

/** Filas de módulos: true = negro. Corrección media (aguanta impresión). */
export function qrMatrix(text: string): boolean[][] {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const n = modules.size;
  const rows: boolean[][] = [];
  for (let y = 0; y < n; y++) {
    const row: boolean[] = [];
    for (let x = 0; x < n; x++) row.push(modules.get(y, x) === 1);
    rows.push(row);
  }
  return rows;
}

/**
 * Tramos horizontales de módulos negros [x, y, ancho], para dibujar menos
 * rectángulos (y que el QR no tenga rayas finas al imprimir).
 */
export function qrRuns(matrix: boolean[][]): [number, number, number][] {
  const runs: [number, number, number][] = [];
  matrix.forEach((row, y) => {
    let start = -1;
    row.forEach((on, x) => {
      if (on && start < 0) start = x;
      if ((!on || x === row.length - 1) && start >= 0) {
        const end = on ? x + 1 : x;
        runs.push([start, y, end - start]);
        start = -1;
      }
    });
  });
  return runs;
}
