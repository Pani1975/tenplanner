import { describe, expect, it } from "vitest";
import {
  IMPORT_PDF_MAX_BYTES,
  IMPORT_SHEET_MAX_ROWS_PER_SHEET,
  detectDocumentKind,
  describeSheetsRead,
  estimatePdfPages,
  looksLikeStudentList,
  sheetsToText,
  validateUploadMeta,
} from "@/lib/import/documents";

const bytes = (s: string) => new TextEncoder().encode(s);

describe("validateUploadMeta", () => {
  it("acepta pdf, xlsx y csv dentro del límite", () => {
    expect(validateUploadMeta("a.pdf", 1000).ok).toBe(true);
    expect(validateUploadMeta("a.XLSX", 1000).ok).toBe(true);
    expect(validateUploadMeta("a.csv", 1000).ok).toBe(true);
  });
  it("rechaza vacío, grande y otros formatos con mensaje claro", () => {
    expect(validateUploadMeta("a.pdf", 0).ok).toBe(false);
    const big = validateUploadMeta("a.pdf", IMPORT_PDF_MAX_BYTES + 1);
    expect(big.ok === false && big.error).toMatch(/pesa demasiado/);
    const doc = validateUploadMeta("a.doc", 10);
    expect(doc.ok === false && doc.error).toMatch(/Formato no admitido/);
  });
});

describe("detectDocumentKind", () => {
  it("comprueba la cabecera, no solo la extensión", () => {
    expect(detectDocumentKind("a.pdf", bytes("%PDF-1.7"))).toBe("pdf");
    expect(detectDocumentKind("a.pdf", bytes("hola"))).toBeNull();
    expect(detectDocumentKind("a.xlsx", bytes("PK\u0003\u0004"))).toBe("sheet");
    expect(detectDocumentKind("a.xlsx", bytes("texto"))).toBeNull();
    expect(detectDocumentKind("a.csv", bytes("a;b\n1;2"))).toBe("sheet");
    expect(detectDocumentKind("a.csv", new Uint8Array([0, 1, 2]))).toBeNull();
  });
});

describe("estimatePdfPages", () => {
  it("cuenta páginas y no confunde /Pages", () => {
    const pdf = bytes("%PDF-1.4 /Type /Pages /Type /Page /Type/Page /Type /Page");
    expect(estimatePdfPages(pdf)).toBe(3);
    expect(estimatePdfPages(bytes("%PDF-1.5 sin objetos"))).toBeNull();
  });
});

describe("sheetsToText", () => {
  it("una línea por fila, sin filas vacías, hoja por hoja", () => {
    const r = sheetsToText([
      { name: "Volea", rows: [["Ejercicio", "Min"], [null, ""], ["Cruzada", 10]] },
      { name: "Vacía", rows: [[]] },
      { name: "Saque", rows: [["Flat", new Date("2026-01-02T00:00:00Z")]] },
    ]);
    expect(r.text).toBe(
      "## Hoja: Volea\nEjercicio | Min\nCruzada | 10\n\n## Hoja: Saque\nFlat | 2026-01-02"
    );
    expect(r.sheetsRead).toBe(2);
    expect(r.rowsRead).toBe(3);
    expect(r.truncated).toBe(false);
  });

  it("limita filas por hoja y lo indica", () => {
    const rows = Array.from({ length: IMPORT_SHEET_MAX_ROWS_PER_SHEET + 50 }, (_, i) => [
      `fila ${i}`,
    ]);
    const r = sheetsToText([{ name: "H", rows }]);
    expect(r.rowsRead).toBe(IMPORT_SHEET_MAX_ROWS_PER_SHEET);
    expect(r.rowsTotal).toBe(IMPORT_SHEET_MAX_ROWS_PER_SHEET + 50);
    expect(r.truncated).toBe(true);
    expect(describeSheetsRead(r)).toMatch(/no se ha importado/);
  });

  it("respeta el límite de caracteres", () => {
    const rows = Array.from({ length: 100 }, () => ["x".repeat(50)]);
    const r = sheetsToText([{ name: "H", rows }], 500);
    expect(r.text.length).toBeLessThanOrEqual(500);
    expect(r.truncated).toBe(true);
  });
});

describe("looksLikeStudentList", () => {
  it("detecta teléfonos y correos", () => {
    expect(
      looksLikeStudentList([
        ["Nombre", "Teléfono", "Email"],
        ["Ana Pérez", "612 345 678", "ana@correo.es"],
        ["Luis Gil", "699887766", "luis@correo.es"],
        ["Marta Ruiz", "611223344", "marta@correo.es"],
      ])
    ).toBe(true);
  });
  it("no marca ejercicios", () => {
    expect(
      looksLikeStudentList([
        ["Ejercicio", "Descripción", "Duración"],
        ["Cruzada", "Peloteo cruzado de derecha", 10],
        ["Globo", "Globo defensivo a la esquina", 8],
        ["Saque", "Saque a la T con 20 pelotas", 12],
      ])
    ).toBe(false);
  });
});
