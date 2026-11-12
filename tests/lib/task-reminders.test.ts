import { describe, expect, it } from "vitest";
import { buildReminderEmail, todayInMadrid } from "@/lib/task-reminders";

const task = (over: Partial<Parameters<typeof buildReminderEmail>[2][number]>) => ({
  id: "1",
  title: "Renovar seguro",
  description: null,
  dueDate: "2026-12-01",
  responsible: "Gestoría",
  ...over,
});

describe("todayInMadrid", () => {
  it("usa la fecha de España, no la UTC", () => {
    // 23:30 UTC del 30 de noviembre ya es 1 de diciembre en Madrid (UTC+1).
    expect(todayInMadrid(new Date("2026-11-30T23:30:00Z"))).toBe("2026-12-01");
    expect(todayInMadrid(new Date("2026-11-30T10:00:00Z"))).toBe("2026-11-30");
  });
});

describe("buildReminderEmail", () => {
  it("una tarea: el asunto lleva su título", () => {
    const mail = buildReminderEmail(
      "club@example.com",
      "CT Prueba",
      [task({})],
      "https://tenplanner.com/calendar",
      "2026-12-01"
    );
    expect(mail.to).toBe("club@example.com");
    expect(mail.subject).toBe("Tarea de gestión: Renovar seguro");
    expect(mail.text).toContain("vence hoy");
    expect(mail.text).toContain("Responsable: Gestoría");
  });

  it("varias tareas: cuenta cuántas y marca las atrasadas", () => {
    const mail = buildReminderEmail(
      "club@example.com",
      "CT Prueba",
      [task({ id: "2", title: "B", dueDate: "2026-11-28" }), task({})],
      "https://tenplanner.com/calendar",
      "2026-12-01"
    );
    expect(mail.subject).toBe("2 tareas de gestión para hoy");
    expect(mail.text).toContain("venció el 28 de noviembre de 2026");
    // La más antigua va primero.
    expect(mail.text.indexOf("- B")).toBeLessThan(
      mail.text.indexOf("- Renovar seguro")
    );
  });

  it("escapa el HTML de los textos del usuario", () => {
    const mail = buildReminderEmail(
      "club@example.com",
      "Club <b>",
      [task({ title: "<script>alert(1)</script>", description: "a & b" })],
      "https://tenplanner.com/calendar",
      "2026-12-01"
    );
    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("a &amp; b");
    expect(mail.html).toContain("Club &lt;b&gt;");
  });
});
