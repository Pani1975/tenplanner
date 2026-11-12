// Lectura en el servidor del archivo subido (PDF, Excel o CSV). Todo en
// memoria: el archivo no se guarda y su contenido no se escribe en logs.

import readXlsxFile from "read-excel-file/node";
import { parseCsv } from "@/lib/students/import";
import {
  IMPORT_PDF_MAX_PAGES,
  describeSheetsRead,
  detectDocumentKind,
  estimatePdfPages,
  looksLikeStudentList,
  sheetsToText,
  validateUploadMeta,
  type SheetInput,
} from "@/lib/import/documents";

export type UploadContent =
  | { type: "pdf"; data: Uint8Array; notes: string[]; chars: number }
  | { type: "text"; text: string; notes: string[]; chars: number };

export type UploadResult =
  | { ok: true; content: UploadContent }
  | { ok: false; error: string; status: number };

const SCANNED_NOTE =
  "Los PDF escaneados o hechos con fotos pueden leerse mal: revisa con cuidado cada borrador.";

export async function readUpload(file: File): Promise<UploadResult> {
  const meta = validateUploadMeta(file.name, file.size);
  if (!meta.ok) return { ok: false, error: meta.error, status: 400 };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = detectDocumentKind(file.name, bytes);
  if (!kind) {
    return {
      ok: false,
      error:
        "El archivo no parece un PDF, un Excel (.xlsx) ni un CSV válido. Comprueba que no esté dañado.",
      status: 400,
    };
  }

  if (kind === "pdf") {
    const pages = estimatePdfPages(bytes);
    if (pages !== null && pages > IMPORT_PDF_MAX_PAGES) {
      return {
        ok: false,
        error: `El PDF tiene unas ${pages} páginas y el máximo es ${IMPORT_PDF_MAX_PAGES}. Divídelo en partes e impórtalas una a una.`,
        status: 400,
      };
    }
    return {
      ok: true,
      content: {
        type: "pdf",
        data: bytes,
        chars: bytes.length,
        notes: [SCANNED_NOTE],
      },
    };
  }

  let sheets: SheetInput[];
  try {
    if (file.name.toLowerCase().endsWith(".csv")) {
      sheets = [
        {
          name: file.name.replace(/\.csv$/i, ""),
          rows: parseCsv(new TextDecoder("utf-8").decode(bytes)),
        },
      ];
    } else {
      const read = await readXlsxFile(Buffer.from(bytes));
      sheets = read.map((s) => ({ name: s.sheet, rows: s.data as unknown[][] }));
    }
  } catch {
    return {
      ok: false,
      error:
        "No he podido leer la hoja de cálculo. Guárdala de nuevo como .xlsx o .csv e inténtalo otra vez.",
      status: 400,
    };
  }

  // Una lista de alumnos no son ejercicios: se avisa y no se manda a la IA.
  if (sheets.some((s) => looksLikeStudentList(s.rows))) {
    return {
      ok: false,
      error:
        "Este archivo parece una lista de personas (teléfonos o correos), no ejercicios ni clases, así que no lo he procesado. Para dar de alta alumnos usa Alumnos → Importar.",
      status: 422,
    };
  }

  const converted = sheetsToText(sheets);
  if (!converted.text.trim()) {
    return {
      ok: false,
      error: "La hoja de cálculo no tiene datos que importar.",
      status: 422,
    };
  }
  return {
    ok: true,
    content: {
      type: "text",
      text: converted.text,
      chars: converted.text.length,
      notes: [describeSheetsRead(converted)],
    },
  };
}
