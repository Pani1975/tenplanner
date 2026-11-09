import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  sessionCloseFields,
  sessionCloseValues,
} from "@/lib/sessions/close-schema";
import {
  PLAN_CHANGE_REASONS,
  planChangeReasonLabel,
} from "@/lib/sessions/plan-change";

const schema = z.object(sessionCloseFields);

describe("cierre de sesión", () => {
  it("según lo planificado: guarda la valoración y borra el motivo", () => {
    expect(
      sessionCloseValues({
        planFollowed: true,
        planChangeReason: "tiempo",
        sessionRating: 4,
      })
    ).toEqual({ planFollowed: true, planChangeReason: null, sessionRating: 4 });
  });

  it("cambió respecto al plan: guarda el motivo (opcional)", () => {
    expect(
      sessionCloseValues({ planFollowed: false, planChangeReason: "lesion" })
    ).toEqual({ planFollowed: false, planChangeReason: "lesion" });
    expect(
      sessionCloseValues({ planFollowed: false, planChangeReason: null })
    ).toEqual({ planFollowed: false, planChangeReason: null });
  });

  it("solo la valoración (al volver de editar) no toca la respuesta del plan", () => {
    expect(sessionCloseValues({ sessionRating: 5 })).toEqual({
      sessionRating: 5,
    });
  });

  it("valida la valoración de 1 a 5 y los motivos conocidos", () => {
    expect(schema.safeParse({ sessionRating: 0 }).success).toBe(false);
    expect(schema.safeParse({ sessionRating: 6 }).success).toBe(false);
    expect(schema.safeParse({ planChangeReason: "inventado" }).success).toBe(
      false
    );
    expect(
      schema.safeParse({ planFollowed: false, planChangeReason: "otro" })
        .success
    ).toBe(true);
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("todos los motivos caben en la columna y tienen etiqueta", () => {
    for (const r of PLAN_CHANGE_REASONS) {
      expect(r.id.length).toBeLessThanOrEqual(40);
      expect(planChangeReasonLabel(r.id)).toBe(r.label);
    }
    expect(planChangeReasonLabel(null)).toBeNull();
  });
});
