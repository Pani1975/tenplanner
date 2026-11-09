import { describe, expect, it } from "vitest";
import {
  PLAN_CHANGE_REASONS,
  PLAN_CHANGE_REASON_IDS,
  planChangeReasonLabel,
} from "@/lib/sessions/plan-change";

describe("motivos de cambio de la sesión", () => {
  it("todos caben en la columna y tienen etiqueta", () => {
    for (const r of PLAN_CHANGE_REASONS) {
      expect(r.id.length).toBeLessThanOrEqual(40);
      expect(planChangeReasonLabel(r.id)).toBe(r.label);
    }
    expect(new Set(PLAN_CHANGE_REASON_IDS).size).toBe(
      PLAN_CHANGE_REASONS.length
    );
  });

  it("sin motivo o con uno desconocido no muestra etiqueta", () => {
    expect(planChangeReasonLabel(null)).toBeNull();
    expect(planChangeReasonLabel("inventado")).toBeNull();
  });
});
