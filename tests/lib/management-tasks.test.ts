import { describe, expect, it } from "vitest";
import { taskInputSchema, taskValues } from "@/lib/management-tasks";

describe("taskInputSchema", () => {
  it("acepta una tarea mínima: solo el título", () => {
    const parsed = taskInputSchema.safeParse({ title: "  Renovar seguro " });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(taskValues(parsed.data)).toMatchObject({
        title: "Renovar seguro",
        dueDate: null,
        notifyEmail: false,
        responsibleKind: "club",
        responsibleUserId: null,
        responsibleText: null,
      });
    }
  });

  it("el aviso por correo necesita fecha de finalización", () => {
    expect(
      taskInputSchema.safeParse({ title: "x", notifyEmail: true }).success
    ).toBe(false);
    expect(
      taskInputSchema.safeParse({
        title: "x",
        notifyEmail: true,
        dueDate: "2026-12-01",
      }).success
    ).toBe(true);
  });

  it("'otro' responsable necesita un texto", () => {
    expect(
      taskInputSchema.safeParse({ title: "x", responsibleKind: "other" })
        .success
    ).toBe(false);
    const ok = taskInputSchema.safeParse({
      title: "x",
      responsibleKind: "other",
      responsibleText: " La gestoría ",
    });
    expect(ok.success).toBe(true);
    if (ok.success)
      expect(taskValues(ok.data).responsibleText).toBe("La gestoría");
  });

  it("rechaza fechas inventadas y solo guarda el responsable de su tipo", () => {
    expect(
      taskInputSchema.safeParse({ title: "x", dueDate: "2026-13-45" }).success
    ).toBe(false);
    const parsed = taskInputSchema.parse({
      title: "x",
      responsibleKind: "club",
      responsibleUserId: "6f1c6ad6-8c52-4a43-9f3a-0f5a2d0f2b11",
      responsibleText: "otro",
    });
    expect(taskValues(parsed)).toMatchObject({
      responsibleUserId: null,
      responsibleText: null,
    });
  });
});
