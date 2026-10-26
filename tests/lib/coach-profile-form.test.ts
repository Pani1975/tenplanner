import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CoachProfileForm } from "@/components/app/coach-profile-form";

const noop = async () => ({ ok: true as const });

describe("CoachProfileForm", () => {
  it("muestra todos los campos de la ficha", () => {
    const html = renderToStaticMarkup(
      createElement(CoachProfileForm, {
        submitLabel: "Guardar",
        onSubmit: noop,
      })
    );
    for (const text of [
      "Nombre y apellidos",
      "Email",
      "Teléfono",
      "Formación académica",
      "Formación en tenis",
      "Disponibilidad horaria",
      "Año en el que empezaste a dar clases",
      "Experiencia como monitor",
      "Añadir experiencia",
      "Guardar",
    ]) {
      expect(html).toContain(text);
    }
  });

  it("ofrece 7 días × 3 bloques y el botón 'Todos'", () => {
    const html = renderToStaticMarkup(
      createElement(CoachProfileForm, {
        submitLabel: "Guardar",
        onSubmit: noop,
      })
    );
    expect(html.match(/role="checkbox"/g)).toHaveLength(21);
    expect(html).toContain("Lunes");
    expect(html).toContain("Domingo");
    expect(html).toContain("Mediodía");
    expect(html).toContain(">Todos<");
  });

  it("marca la disponibilidad y la experiencia recibidas", () => {
    const html = renderToStaticMarkup(
      createElement(CoachProfileForm, {
        submitLabel: "Guardar",
        onSubmit: noop,
        initial: {
          fullName: "Ángel Pérez",
          email: "a@x.com",
          phone: "600123456",
          availability: { lunes: ["manana", "mediodia", "tarde"] },
          experience: [
            { startYear: 2018, endYear: null, company: "CT", role: "Monitor" },
          ],
        },
      })
    );
    expect(html.match(/aria-checked="true"/g)).toHaveLength(3);
    expect(html).toContain('value="2018"');
    expect(html).toContain("Hasta la actualidad");
    expect(html).toContain('value="Ángel Pérez"');
  });

  it("bloquea el email y pide consentimiento en el enlace público", () => {
    const html = renderToStaticMarkup(
      createElement(CoachProfileForm, {
        submitLabel: "Enviar",
        onSubmit: noop,
        lockEmail: true,
        consentLabel: "Acepto el tratamiento",
        initial: { email: "a@x.com" },
      })
    );
    expect(html).toMatch(/readOnly=""|readonly=""/i);
    expect(html).toContain("Acepto el tratamiento");
  });
});
