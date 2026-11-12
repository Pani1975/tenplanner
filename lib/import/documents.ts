// Importar documentos (fase 2): funciones puras para validar archivos y
// convertir hojas de cálculo a texto. Sin acceso a la base ni al sistema de
// archivos, para poder probarlas con tests unitarios. El archivo nunca se
// guarda: se lee en memoria y se descarta.

import { IMPORT_MAX_CHARS } from "@/lib/import/schema";

// Vercel corta las peticiones de más de 4,5 MB antes de llegar a la función:
// los límites quedan por debajo.
export const IMPORT_PDF_MAX_BYTES = 4 * 1024 * 1024;
export const IMPORT_SHEET_MAX_BYTES = 4 * 1024 * 1024;
export const IMPORT_PDF_MAX_PAGES = 30;
export const IMPORT_SHEET_MAX_ROWS_PER_SHEET = 300;
export const IMPORT_SHEET_MAX_SHEETS = 10;

export type DocumentKind = "pdf" | "sheet";

const mb = (n: number) => `${Math.round(n / 1024 / 1024)} MB`;

/** Tipo de archivo por nombre y cabecera (no se fía solo de la extensión). */
export function detectDocumentKind(
  name: string,
  head: Uint8Array
): DocumentKind | null {
  const lower = name.toLowerCase();
  const startsWith = (s: string) =>
    s.split("").every((c, i) => head[i] === c.charCodeAt(0));
  if (lower.endsWith(".pdf")) return startsWith("%PDF-") ? "pdf" : null;
  if (lower.endsWith(".xlsx")) return startsWith("PK") ? "sheet" : null;
  if (lower.endsWith(".csv")) {
    // Un CSV es texto: si trae bytes de control, no lo es.
    const sample = head.subarray(0, 512);
    return sample.some((b) => b === 0) ? null : "sheet";
  }
  return null;
}

export function validateUploadMeta(
  name: string,
  size: number
): { ok: true } | { ok: false; error: string } {
  const lower = name.toLowerCase();
  if (size <= 0) return { ok: false, error: "El archivo está vacío." };
  if (lower.endsWith(".pdf")) {
    return size > IMPORT_PDF_MAX_BYTES
      ? {
          ok: false,
          error: `El PDF pesa demasiado. El máximo es ${mb(IMPORT_PDF_MAX_BYTES)}: divídelo o comprímelo.`,
        }
      : { ok: true };
  }
  if (lower.endsWith(".xlsx") || lower.endsWith(".csv")) {
    return size > IMPORT_SHEET_MAX_BYTES
      ? {
          ok: false,
          error: `La hoja de cálculo pesa demasiado. El máximo es ${mb(IMPORT_SHEET_MAX_BYTES)}.`,
        }
      : { ok: true };
  }
  return {
    ok: false,
    error:
      "Formato no admitido. Sube un PDF, un Excel (.xlsx) o un CSV. Los .xls y .doc antiguos guárdalos antes como .xlsx o PDF.",
  };
}

/**
 * Páginas aproximadas de un PDF contando objetos /Type /Page. En PDFs con
 * objetos comprimidos no se ve: devuelve null (se deja pasar y lo limita el
 * proveedor).
 */
export function estimatePdfPages(bytes: Uint8Array): number | null {
  let text = "";
  const chunk = 1 << 16;
  for (let i = 0; i < bytes.length; i += chunk) {
    text += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const matches = text.match(/\/Type\s*\/Page(?![a-zA-Z])/g);
  return matches ? matches.length : null;
}

// ── Hojas de cálculo → texto

export type SheetInput = { name: string; rows: unknown[][] };

function cellToString(cell: unknown): string {
  if (cell === null || cell === undefined) return "";
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  return String(cell).replace(/\s+/g, " ").trim();
}

export type SheetsText = {
  text: string;
  sheetsRead: number;
  sheetsTotal: number;
  rowsRead: number;
  rowsTotal: number;
  truncated: boolean;
};

/**
 * Convierte las hojas a texto (una línea por fila, celdas separadas por " | "),
 * hoja por hoja, sin filas vacías y con límites de hojas, filas y caracteres.
 */
export function sheetsToText(
  sheets: readonly SheetInput[],
  maxChars = IMPORT_MAX_CHARS
): SheetsText {
  let rowsTotal = 0;
  let rowsRead = 0;
  let sheetsRead = 0;
  let truncated = sheets.length > IMPORT_SHEET_MAX_SHEETS;
  const parts: string[] = [];
  let used = 0;

  for (const sheet of sheets.slice(0, IMPORT_SHEET_MAX_SHEETS)) {
    const lines = sheet.rows
      .map((r) => r.map(cellToString))
      .filter((cells) => cells.some((c) => c !== ""))
      .map((cells) => cells.join(" | ").replace(/( \| )+$/, ""));
    rowsTotal += lines.length;
    if (lines.length === 0) continue;

    const header = `## Hoja: ${sheet.name}`;
    const body: string[] = [];
    let sheetRows = 0;
    for (const line of lines.slice(0, IMPORT_SHEET_MAX_ROWS_PER_SHEET)) {
      if (used + header.length + body.join("\n").length + line.length + 2 > maxChars) {
        truncated = true;
        break;
      }
      body.push(line);
      sheetRows += 1;
    }
    if (lines.length > sheetRows) truncated = true;
    if (body.length === 0) break;
    parts.push([header, ...body].join("\n"));
    used += header.length + body.join("\n").length + 2;
    rowsRead += sheetRows;
    sheetsRead += 1;
  }

  return {
    text: parts.join("\n\n"),
    sheetsRead,
    sheetsTotal: sheets.length,
    rowsRead,
    rowsTotal,
    truncated,
  };
}

/** Frase para la pantalla de revisión con lo que se ha leído. */
export function describeSheetsRead(r: SheetsText): string {
  const base = `Se han leído ${r.rowsRead} de ${r.rowsTotal} filas (${r.sheetsRead} de ${r.sheetsTotal} hojas).`;
  return r.truncated
    ? `${base} El documento era largo: lo que quedó fuera no se ha importado. Divídelo y vuelve a importar el resto.`
    : base;
}

// ── Lista de alumnos (no son ejercicios)

const EMAIL_RE = /[^\s@|]+@[^\s@|]+\.[a-z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\s.-]?){9,}/;
const HEADER_RE =
  /\b(tel[eé]fono|m[oó]vil|e-?mail|correo|dni|nif|fecha de nacimiento|tutor|padre|madre|alumno)\b/i;

/**
 * ¿Parece una lista de personas (teléfonos, correos, datos de contacto) y no
 * ejercicios o clases? Se usa para avisar y no procesarla.
 */
export function looksLikeStudentList(rows: readonly unknown[][]): boolean {
  const lines = rows
    .map((r) => r.map(cellToString))
    .filter((cells) => cells.some((c) => c !== ""));
  if (lines.length < 3) return false;

  const header = lines[0].join(" | ");
  const headerHits = lines[0].filter((c) => HEADER_RE.test(c)).length;
  const data = lines.slice(1);
  const withContact = data.filter((cells) => {
    const joined = cells.join(" | ");
    return EMAIL_RE.test(joined) || PHONE_RE.test(joined);
  }).length;
  const ratio = withContact / data.length;

  if (ratio >= 0.5) return true;
  return headerHits >= 2 && ratio >= 0.2 && HEADER_RE.test(header);
}
