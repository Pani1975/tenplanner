import { describe, expect, it } from "vitest";
import readXlsx from "read-excel-file/node";
import writeXlsxFile from "write-excel-file/node";
import {
  buildImportRows,
  guessMapping,
  parseCsv,
  parseDateCell,
  parseGender,
  parseHand,
  parseHowFound,
  parseLevel,
  type CellValue,
} from "@/lib/students/import";

const now = new Date("2026-11-10T12:00:00Z");

describe("importar alumnos: valores", () => {
  it("entiende fechas en formato español, ISO y de Excel", () => {
    expect(parseDateCell("15/03/2014", now)).toBe("2014-03-15");
    expect(parseDateCell("5-3-14", now)).toBe("2014-03-05");
    expect(parseDateCell("05.03.98", now)).toBe("1998-03-05");
    expect(parseDateCell("2014-03-15", now)).toBe("2014-03-15");
    expect(parseDateCell(new Date(Date.UTC(2014, 2, 15)), now)).toBe("2014-03-15");
    expect(parseDateCell(41713, now)).toBe("2014-03-15");
    expect(parseDateCell("31/02/2014", now)).toBeNull();
    expect(parseDateCell("ayer", now)).toBeNull();
  });

  it("entiende género, mano, nivel y cómo nos conoció escritos de varias formas", () => {
    expect(parseGender("M")).toBe("male");
    expect(parseGender("Chica")).toBe("female");
    expect(parseGender("¿?")).toBeNull();
    expect(parseHand("Zurdo")).toBe("left");
    expect(parseHand("D")).toBe("right");
    expect(parseLevel("Consolidación")).toBe("consolidacion");
    expect(parseLevel("precompeticion")).toBe("precompeticion");
    expect(parseLevel("Rendimiento")).toBeNull();
    expect(parseHowFound("Redes sociales")).toEqual({ howFound: "redes_sociales", detail: null });
    expect(parseHowFound("Por Instagram")).toEqual({ howFound: "redes_sociales", detail: "Por Instagram" });
    expect(parseHowFound("La vecina del 5º")).toEqual({ howFound: "pasaba_por_club", detail: "La vecina del 5º" });
    expect(parseHowFound("Ni idea")).toEqual({ howFound: "otro", detail: "Ni idea" });
  });

  it("reconoce las columnas por su cabecera", () => {
    expect(
      guessMapping(["Alumno", "F. nacimiento", "Sexo", "Móvil", "Grupo", "Cuota", "Observaciones"])
    ).toEqual(["name", "birthDate", "gender", "phone", "group", null, "notes"]);
  });

  it("lee CSV con punto y coma, comillas y BOM", () => {
    expect(parseCsv('﻿Nombre;Notas\r\n"Pérez; Ana";"Dice ""hola""\nadiós"\r\nLuis;\r\n')).toEqual([
      ["Nombre", "Notas"],
      ["Pérez; Ana", 'Dice "hola"\nadiós'],
      ["Luis", ""],
    ]);
    expect(parseCsv("Nombre,Email\nAna,ana@x.es")).toEqual([
      ["Nombre", "Email"],
      ["Ana", "ana@x.es"],
    ]);
  });
});

describe("importar alumnos: filas", () => {
  const sheet: CellValue[][] = [
    ["Nombre", "Fecha de nacimiento", "Email", "Género", "Nivel", "Grupo"],
    ["Lucía Pérez", "15/03/2014", "LUCIA@ejemplo.com", "F", "Consolidación", "Verde"],
    ["", "", "", "", "", ""],
    ["Pablo", "fecha rara", "no-es-email", "X", "Nivel 9", ""],
    ["", "01/01/2015", "", "", "", ""],
    ["lucía  pérez", "15/03/2014", "", "", "", ""],
  ];
  const rows = buildImportRows(sheet, guessMapping(sheet[0]), now);

  it("ignora filas vacías y conserva el número de fila", () => {
    expect(rows.map((r) => r.line)).toEqual([2, 4, 5, 6]);
  });

  it("normaliza los valores válidos", () => {
    expect(rows[0].student).toMatchObject({
      name: "Lucía Pérez",
      birthDate: "2014-03-15",
      email: "lucia@ejemplo.com",
      gender: "female",
      playerLevel: "consolidacion",
      group: "Verde",
    });
    expect(rows[0].errors).toEqual([]);
  });

  it("deja vacío lo que no entiende y lo avisa", () => {
    expect(rows[1].errors).toEqual([]);
    expect(rows[1].student).toMatchObject({ birthDate: null, email: null, gender: "other", playerLevel: null });
    expect(rows[1].warnings.join(" ")).toContain("Fecha de nacimiento «fecha rara»");
    expect(rows[1].warnings.join(" ")).toContain("Email «no-es-email»");
  });

  it("marca como error las filas sin nombre y las repetidas en el archivo", () => {
    expect(rows[2].errors).toEqual(["Falta el nombre"]);
    expect(rows[3].errors).toEqual(["Repetido en el archivo (igual que la fila 2)"]);
  });
});

describe("importar alumnos: archivo Excel real", () => {
  it("lee un .xlsx con fechas y números", async () => {
    const buffer = (await writeXlsxFile(
      [
        [{ value: "Nombre" }, { value: "Fecha de nacimiento" }, { value: "Altura" }, { value: "Fecha de alta" }],
        [
          { value: "Ana" },
          { value: new Date(Date.UTC(2013, 5, 9)), type: Date, format: "dd/mm/yyyy" },
          { value: 141, type: Number },
          { value: "01/09/2025" },
        ],
      ],
      {}
    ).toBuffer()) as Buffer;
    const sheets = await readXlsx(buffer);
    const data = sheets[0].data as unknown as CellValue[][];
    const [row] = buildImportRows(data, guessMapping(data[0]), now);
    expect(row.student).toMatchObject({
      name: "Ana",
      birthDate: "2013-06-09",
      heightCm: 141,
      joinedAt: "2025-09-01",
    });
  });
});
