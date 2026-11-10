import { describe, expect, it } from "vitest";
import {
  createStudentSchema,
  updateStudentSchema,
} from "@/app/api/students/validation";
import {
  buildImportRows,
  guessMapping,
  type CellValue,
} from "@/lib/students/import";
import { joinFullName, splitFullName } from "@/lib/students/names";

const now = new Date("2026-11-10T12:00:00Z");

describe("nombre y apellidos del alumno", () => {
  it("separa nombres completos al estilo español", () => {
    expect(splitFullName("Lucía Pérez García")).toEqual({
      firstName: "Lucía",
      lastName: "Pérez García",
    });
    expect(splitFullName("María José García López")).toEqual({
      firstName: "María José",
      lastName: "García López",
    });
    expect(splitFullName("Juan de la Fuente García")).toEqual({
      firstName: "Juan",
      lastName: "de la Fuente García",
    });
    expect(splitFullName("José Luis del Río Santos")).toEqual({
      firstName: "José Luis",
      lastName: "del Río Santos",
    });
    expect(splitFullName("  Ana   García ")).toEqual({
      firstName: "Ana",
      lastName: "García",
    });
    expect(splitFullName("Pablo")).toEqual({
      firstName: "Pablo",
      lastName: null,
    });
  });

  it("une nombre y apellidos en el nombre completo", () => {
    expect(joinFullName(" Lucía ", "Pérez  García")).toBe("Lucía Pérez García");
    expect(joinFullName("Pablo", null)).toBe("Pablo");
  });

  it("acepta el alta con nombre y apellidos o con el nombre completo", () => {
    expect(
      createStudentSchema.safeParse({ firstName: "Lucía", lastName: "Pérez" })
        .success
    ).toBe(true);
    expect(createStudentSchema.safeParse({ name: "Lucía Pérez" }).success).toBe(
      true
    );
    expect(createStudentSchema.safeParse({ lastName: "Pérez" }).success).toBe(
      false
    );
    expect(updateStudentSchema.safeParse({ lastName: null }).success).toBe(
      true
    );
    expect(updateStudentSchema.safeParse({ firstName: "" }).success).toBe(
      false
    );
  });
});

describe("importar alumnos con nombre y apellidos", () => {
  it("usa Nombre + Primer y Segundo apellido", () => {
    const sheet: CellValue[][] = [
      ["Nombre", "Primer apellido", "Segundo apellido"],
      ["Lucía", "Pérez", "García"],
    ];
    const mapping = guessMapping(sheet[0]);
    expect(mapping).toEqual(["firstName", "lastName", "secondLastName"]);
    expect(buildImportRows(sheet, mapping, now)[0].student).toMatchObject({
      firstName: "Lucía",
      lastName: "Pérez García",
      name: "Lucía Pérez García",
    });
  });

  it("separa una sola columna con el nombre completo", () => {
    const sheet: CellValue[][] = [
      ["Nombre y apellidos"],
      ["María José García López"],
    ];
    const mapping = guessMapping(sheet[0]);
    expect(mapping).toEqual(["name"]);
    expect(buildImportRows(sheet, mapping, now)[0].student).toMatchObject({
      firstName: "María José",
      lastName: "García López",
      name: "María José García López",
    });
  });
});
