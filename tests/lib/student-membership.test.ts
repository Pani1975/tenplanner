import { describe, expect, it } from "vitest";
import {
  createStudentSchema,
  updateStudentSchema,
} from "@/app/api/students/validation";
import {
  HOW_FOUND_OPTIONS,
  LEFT_REASON_OPTIONS,
  howFoundLabel,
  leftReasonLabel,
} from "@/lib/students/membership";

describe("alta y baja del alumno", () => {
  it("traduce las claves a etiquetas", () => {
    expect(howFoundLabel("redes_sociales")).toBe("Redes sociales");
    expect(leftReasonLabel("economico")).toBe("Motivos económicos");
    expect(howFoundLabel(null)).toBeNull();
    expect(leftReasonLabel("inventado")).toBeNull();
  });

  it("no repite claves", () => {
    for (const list of [HOW_FOUND_OPTIONS, LEFT_REASON_OPTIONS]) {
      const ids = list.map((o) => o.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("valida cómo nos conoció y la baja al crear o editar", () => {
    const ok = createStudentSchema.safeParse({
      name: "Ana",
      joinedAt: "2026-09-01",
      howFound: "recomendacion",
      howFoundDetail: "La familia de Pablo",
      leftAt: "2026-10-20",
      leftReason: "lesion",
      leftReasonDetail: "Operación de rodilla",
    });
    expect(ok.success).toBe(true);

    expect(
      createStudentSchema.safeParse({ name: "Ana", howFound: "no_existe" })
        .success
    ).toBe(false);
    expect(
      createStudentSchema.safeParse({ name: "Ana", leftAt: "20/10/2026" })
        .success
    ).toBe(false);
    expect(
      createStudentSchema.safeParse({ name: "Ana", joinedAt: "1/9/2026" })
        .success
    ).toBe(false);
    expect(
      updateStudentSchema.safeParse({ leftAt: null, leftReason: null }).success
    ).toBe(true);
  });
});
