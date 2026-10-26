import { describe, expect, it } from "vitest";
import { buildClubInviteEmail } from "@/lib/club-invite-email";
import { cleanOptionalText, normalizeWebsite } from "@/lib/club-identity";

describe("buildClubInviteEmail", () => {
  const base = {
    to: "angel@example.com",
    inviteeName: "Ángel",
    clubName: "CT Tenerife",
    sportLabel: "Tenis",
    inviteUrl: "https://tenplanner.test/invite/abc123",
    expiryDays: 14,
  };

  it("incluye club, deporte, enlace y caducidad", () => {
    const email = buildClubInviteEmail(base);
    expect(email.subject).toContain("CT Tenerife");
    expect(email.text).toContain("Hola, Ángel");
    expect(email.text).toContain(base.inviteUrl);
    expect(email.text).toContain("14 días");
    expect(email.html).toContain(`href="${base.inviteUrl}"`);
  });

  it("saluda sin nombre cuando no se indicó", () => {
    const email = buildClubInviteEmail({ ...base, inviteeName: null });
    expect(email.text.startsWith("Hola,")).toBe(true);
  });

  it("escapa HTML en nombres escritos por el usuario", () => {
    const email = buildClubInviteEmail({
      ...base,
      clubName: '<script>alert("x")</script>',
      inviteeName: "<b>Ángel</b>",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>Ángel</b>");
    expect(email.html).toContain("&lt;script&gt;");
  });
});

describe("normalizeWebsite", () => {
  it("añade https:// si falta", () => {
    expect(normalizeWebsite("www.miclub.es")).toBe("https://www.miclub.es/");
  });

  it("respeta el esquema indicado", () => {
    expect(normalizeWebsite("http://miclub.es/escuela")).toBe(
      "http://miclub.es/escuela"
    );
  });

  it("devuelve null si está vacía o no es una web", () => {
    expect(normalizeWebsite("")).toBeNull();
    expect(normalizeWebsite("   ")).toBeNull();
    expect(normalizeWebsite("no es una web")).toBeNull();
    expect(normalizeWebsite(null)).toBeNull();
  });
});

describe("cleanOptionalText", () => {
  it("recorta, limita y convierte vacío en null", () => {
    expect(cleanOptionalText("  928 000 000 ", 50)).toBe("928 000 000");
    expect(cleanOptionalText("   ", 50)).toBeNull();
    expect(cleanOptionalText("abcdef", 3)).toBe("abc");
  });
});
