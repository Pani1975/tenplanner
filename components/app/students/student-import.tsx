"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
} from "lucide-react";
import { HOW_FOUND_OPTIONS } from "@/lib/students/membership";
import {
  buildImportRows,
  cellText,
  guessMapping,
  hasNameColumn,
  IMPORT_FIELDS,
  TEMPLATE_FIELDS,
  IMPORT_MAX_ROWS,
  parseCsv,
  type CellValue,
  type ImportFieldKey,
  type ImportRow,
} from "@/lib/students/import";
import { cn } from "@/lib/utils";

type Step = "file" | "map" | "preview" | "done";

interface Check {
  duplicates: Set<number>;
  newGroups: string[];
}

interface Result {
  created: number;
  skipped: number;
  groupsCreated: number;
  located: number;
  withLocality: number;
}

const PREVIEW_LIMIT = 300;

/** Plantilla .xlsx: hoja de alumnos (cabecera + ejemplo) y hoja de valores. */
async function downloadTemplate() {
  const { default: writeXlsxFile } = await import("write-excel-file/browser");
  const header = TEMPLATE_FIELDS.map((f) => ({
    value: f.label,
    fontWeight: "bold" as const,
    backgroundColor: "#D6FF38",
  }));
  const example = TEMPLATE_FIELDS.map((f) => ({ value: f.example }));
  const values: string[][] = [
    ["Campo", "Valores que se entienden"],
    ["Nombre", "Obligatorio. Una fila por alumno."],
    [
      "Apellidos",
      "Los dos apellidos en la misma columna (también vale «Primer apellido» y «Segundo apellido» por separado, o una sola columna «Nombre y apellidos»)",
    ],
    [
      "Fecha de nacimiento / alta",
      "Día/mes/año: 15/03/2014, 15-3-14 o una fecha de Excel",
    ],
    ["Género", "Masculino, Femenino, Otro (también M, F, chico, chica…)"],
    ["Mano dominante", "Diestro o Zurdo (también D, Z, derecha, izquierda)"],
    [
      "Nivel",
      "Descubrimiento, Desarrollo, Consolidación, Especialización, Precompetición, Competición",
    ],
    ["Cómo nos conoció", HOW_FOUND_OPTIONS.map((o) => o.label).join(", ")],
    ["Grupo", "Nombre del grupo; si no existe en el club, se crea"],
    ["Altura / peso", "Números en cm y kg"],
  ];
  await writeXlsxFile(
    [
      {
        sheet: "Alumnos",
        data: [header, example],
        columns: TEMPLATE_FIELDS.map(() => ({ width: 22 })),
        stickyRowsCount: 1,
      },
      {
        sheet: "Valores",
        data: values.map((row, i) =>
          row.map((value) => ({
            value,
            ...(i === 0 ? { fontWeight: "bold" as const } : {}),
          }))
        ),
        columns: [{ width: 28 }, { width: 90 }],
      },
    ],
    {}
  ).toFile("plantilla-alumnos-tenplanner.xlsx");
}

async function readFile(file: File): Promise<CellValue[][]> {
  if (/\.csv$/i.test(file.name) || file.type === "text/csv") {
    return parseCsv(await file.text());
  }
  const { readSheet } = await import("read-excel-file/browser");
  return (await readSheet(file)) as unknown as CellValue[][];
}

export function StudentImport() {
  const [step, setStep] = useState<Step>("file");
  const [fileName, setFileName] = useState("");
  const [sheet, setSheet] = useState<CellValue[][]>([]);
  const [mapping, setMapping] = useState<(ImportFieldKey | null)[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [check, setCheck] = useState<Check | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy("read");
    setError(null);
    try {
      const data = (await readFile(file)).filter((r) =>
        r.some((c) => cellText(c) !== "")
      );
      if (data.length < 2) {
        throw new Error(
          "El archivo no tiene alumnos: necesita una fila de cabecera y al menos un alumno."
        );
      }
      if (data.length - 1 > IMPORT_MAX_ROWS) {
        throw new Error(
          `El archivo tiene ${data.length - 1} filas. Como máximo se importan ${IMPORT_MAX_ROWS} de una vez: divídelo en varios.`
        );
      }
      setFileName(file.name);
      setSheet(data);
      setMapping(guessMapping(data[0]));
      setStep("map");
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "No se pudo leer el archivo. Guárdalo como .xlsx o .csv y vuelve a probar."
      );
    } finally {
      setBusy(null);
    }
  }

  function setField(col: number, key: ImportFieldKey | null) {
    setMapping((prev) =>
      prev.map((k, i) => (i === col ? key : k === key && key ? null : k))
    );
  }

  async function preview() {
    setBusy("check");
    setError(null);
    try {
      const built = buildImportRows(sheet, mapping);
      const valid = built.filter((r) => r.errors.length === 0);
      let duplicates = new Set<number>();
      let newGroups: string[] = [];
      if (valid.length) {
        const res = await fetch("/api/students/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: valid.map((r) => r.student),
            dryRun: true,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok)
          throw new Error(data.error ?? "No se pudo comprobar el archivo");
        duplicates = new Set(
          (data.data.duplicates as number[]).map((i) => valid[i].line)
        );
        newGroups = data.data.newGroups;
      }
      setRows(built);
      setCheck({ duplicates, newGroups });
      setStep("preview");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(null);
    }
  }

  const ready = rows.filter(
    (r) => r.errors.length === 0 && !check?.duplicates.has(r.line)
  );

  async function runImport() {
    setBusy("import");
    setError(null);
    try {
      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: ready.map((r) => r.student),
          dryRun: false,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo importar");
      setResult(data.data);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setStep("file");
    setSheet([]);
    setMapping([]);
    setRows([]);
    setCheck(null);
    setResult(null);
    setError(null);
  }

  const nameMapped = hasNameColumn(mapping);
  const withErrors = rows.filter((r) => r.errors.length > 0).length;
  const duplicateCount = check?.duplicates.size ?? 0;
  const withWarnings = ready.filter((r) => r.warnings.length > 0).length;

  return (
    <div className="space-y-5">
      <ol className="flex flex-wrap gap-2 text-xs font-black uppercase">
        {(
          [
            ["file", "1 · Archivo"],
            ["map", "2 · Columnas"],
            ["preview", "3 · Revisar"],
            ["done", "4 · Hecho"],
          ] as const
        ).map(([key, label]) => (
          <li
            key={key}
            className={cn(
              "rounded-full border px-3 py-1",
              step === key
                ? "border-brand bg-brand/10 text-foreground"
                : "border-border text-muted-foreground"
            )}
          >
            {label}
          </li>
        ))}
      </ol>

      {step === "file" && (
        <section className="tp-panel space-y-4 p-5 sm:p-6">
          <p className="text-sm text-foreground/80">
            Sube el listado de alumnos en Excel (.xlsx) o CSV. La primera fila
            debe tener los nombres de las columnas. Puedes usar tu propio
            archivo: las columnas se reconocen por su nombre y podrás ajustarlas
            antes de importar. Nada se guarda hasta que confirmes.
          </p>
          <div className="flex flex-wrap gap-3">
            <label
              className={cn(
                "inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-[#D6FF38] px-5 text-sm font-black text-[#050505]",
                busy && "pointer-events-none opacity-60"
              )}
            >
              {busy === "read" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Elegir archivo
              <input
                type="file"
                accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
                className="sr-only"
                onChange={(e) => {
                  void onFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </label>
            <button
              type="button"
              onClick={() => void downloadTemplate()}
              className="inline-flex h-11 items-center gap-2 rounded-full border border-border px-5 text-sm font-semibold text-foreground hover:bg-muted"
            >
              <Download className="size-4" />
              Descargar plantilla Excel
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Solo se lee la primera hoja del Excel. Máximo {IMPORT_MAX_ROWS}{" "}
            alumnos por archivo. Los alumnos quedan en el club, como si los
            hubieras creado tú.
          </p>
        </section>
      )}

      {step === "map" && (
        <section className="tp-panel space-y-4 p-5 sm:p-6">
          <div className="flex items-center gap-2 text-sm">
            <FileSpreadsheet className="size-4 text-brand" />
            <span className="font-semibold">{fileName}</span>
            <span className="text-muted-foreground">
              · {sheet.length - 1} filas
            </span>
          </div>
          <p className="text-sm text-foreground/80">
            Comprueba a qué dato de la ficha corresponde cada columna. Las que
            no quieras importar, déjalas en «No importar».
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-[11px] font-black uppercase text-foreground/55">
                  <th className="py-2 pr-3">Columna del archivo</th>
                  <th className="py-2 pr-3">Ejemplo</th>
                  <th className="py-2">Dato de la ficha</th>
                </tr>
              </thead>
              <tbody>
                {sheet[0].map((header, col) => (
                  <tr
                    key={col}
                    className="border-b border-border/60 last:border-0"
                  >
                    <td className="py-2 pr-3 font-semibold text-foreground">
                      {cellText(header) || `Columna ${col + 1}`}
                    </td>
                    <td className="max-w-[200px] truncate py-2 pr-3 text-muted-foreground">
                      {cellText(sheet[1]?.[col]) || "—"}
                    </td>
                    <td className="py-2">
                      <select
                        value={mapping[col] ?? ""}
                        onChange={(e) =>
                          setField(
                            col,
                            (e.target.value || null) as ImportFieldKey | null
                          )
                        }
                        className="h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                      >
                        <option value="">No importar</option>
                        {IMPORT_FIELDS.map((f) => (
                          <option key={f.key} value={f.key}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!nameMapped && (
            <p className="text-xs font-semibold text-red-500">
              Indica qué columna tiene el nombre del alumno («Nombre» o «Nombre
              y apellidos»).
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={preview}
              disabled={!nameMapped || !!busy}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#D6FF38] px-5 text-sm font-black text-[#050505] disabled:opacity-50"
            >
              {busy === "check" && <Loader2 className="size-4 animate-spin" />}
              Revisar alumnos
            </button>
            <button
              type="button"
              onClick={reset}
              className="h-11 rounded-full px-4 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Elegir otro archivo
            </button>
          </div>
        </section>
      )}

      {step === "preview" && check && (
        <section className="tp-panel space-y-4 p-5 sm:p-6">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Se importan", ready.length, "text-[#6D7F00]"],
              ["Ya existen (se omiten)", duplicateCount, "text-amber-600"],
              ["Con errores (se omiten)", withErrors, "text-red-500"],
              ["Con avisos", withWarnings, "text-muted-foreground"],
            ].map(([label, value, color]) => (
              <div
                key={label as string}
                className="rounded-lg border border-border p-3"
              >
                <dt className="text-[11px] font-black uppercase text-foreground/55">
                  {label}
                </dt>
                <dd
                  className={cn(
                    "font-heading text-3xl font-black tabular-nums",
                    color as string
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {check.newGroups.length > 0 && (
            <p className="text-sm text-foreground/80">
              Se crearán {check.newGroups.length} grupo(s) nuevo(s):{" "}
              <span className="font-semibold">
                {check.newGroups.join(", ")}
              </span>
              .
            </p>
          )}

          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-border text-left text-[11px] font-black uppercase text-foreground/55">
                  <th className="px-3 py-2">Fila</th>
                  <th className="px-3 py-2">Alumno</th>
                  <th className="px-3 py-2">Nacimiento</th>
                  <th className="px-3 py-2">Grupo</th>
                  <th className="px-3 py-2">Estado</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, PREVIEW_LIMIT).map((r) => {
                  const duplicate = check.duplicates.has(r.line);
                  return (
                    <tr
                      key={r.line}
                      className="border-b border-border/60 align-top last:border-0"
                    >
                      <td className="px-3 py-2 tabular-nums text-muted-foreground">
                        {r.line}
                      </td>
                      <td className="px-3 py-2 font-semibold text-foreground">
                        {r.student.name || "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.student.birthDate ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {r.student.group ?? "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {r.errors.length > 0 ? (
                          <span className="text-red-500">
                            {r.errors.join(". ")}
                          </span>
                        ) : duplicate ? (
                          <span className="text-amber-600">
                            Ya existe en el club
                          </span>
                        ) : (
                          <span className="text-[#6D7F00]">Se importa</span>
                        )}
                        {r.warnings.length > 0 && (
                          <span className="mt-0.5 block text-muted-foreground">
                            {r.warnings.join(". ")}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {rows.length > PREVIEW_LIMIT && (
            <p className="text-xs text-muted-foreground">
              Se muestran las primeras {PREVIEW_LIMIT} filas de {rows.length};
              el resumen de arriba cuenta todas.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runImport}
              disabled={ready.length === 0 || !!busy}
              className="inline-flex h-11 items-center gap-2 rounded-full bg-[#D6FF38] px-5 text-sm font-black text-[#050505] disabled:opacity-50"
            >
              {busy === "import" ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Upload className="size-4" />
              )}
              Importar {ready.length} alumno{ready.length === 1 ? "" : "s"}
            </button>
            <button
              type="button"
              onClick={() => setStep("map")}
              disabled={!!busy}
              className="h-11 rounded-full px-4 text-sm font-semibold text-muted-foreground hover:bg-muted"
            >
              Volver a las columnas
            </button>
          </div>
        </section>
      )}

      {step === "done" && result && (
        <section className="tp-panel space-y-3 p-5 sm:p-6">
          <p className="flex items-center gap-2 text-lg font-black text-foreground">
            <CheckCircle2 className="size-5 text-[#6D7F00]" />
            {result.created} alumno{result.created === 1 ? "" : "s"} importado
            {result.created === 1 ? "" : "s"}
          </p>
          <ul className="space-y-1 text-sm text-foreground/80">
            {result.skipped > 0 && (
              <li>
                {result.skipped} omitido(s) porque ya existían en el club.
              </li>
            )}
            {result.groupsCreated > 0 && (
              <li>{result.groupsCreated} grupo(s) nuevo(s) creado(s).</li>
            )}
            {result.withLocality > result.located && (
              <li className="flex items-start gap-1.5">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-500" />
                {result.withLocality - result.located} alumno(s) con localidad
                aún sin situar en el mapa de procedencia. Se sitúan al editar su
                ficha y volver a guardar la localidad.
              </li>
            )}
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Link
              href="/students"
              className="inline-flex h-11 items-center rounded-full bg-[#D6FF38] px-5 text-sm font-black text-[#050505]"
            >
              Ver alumnos
            </Link>
            <button
              type="button"
              onClick={reset}
              className="h-11 rounded-full border border-border px-4 text-sm font-semibold text-foreground hover:bg-muted"
            >
              Importar otro archivo
            </button>
          </div>
        </section>
      )}

      {error && (
        <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
