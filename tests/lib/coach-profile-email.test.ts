import { describe, expect, it } from "vitest";
import { buildCoachProfileEmail } from "@/lib/coach-profile-email";

const base = {
  to: "angel@example.com",
  recipientName: "Ángel",
  clubName: "CT Tenerife",
  profileUrl: "https://tenplanner.test/ficha-monitor/abc123",
  expiryDays: 30,
};

describe("buildCoachProfileEmail", () => {
  it("incluye club, enlace y caducidad en texto y HTML", () => {
    const email = buildCoachProfileEmail(base);
    expect(email.subject).toContain("CT Tenerife");
    expect(email.text).toContain("Hola, Ángel");
    expect(email.text).toContain(base.profileUrl);
    expect(email.text).toContain("30 días");
    expect(email.html).toContain(`href="${base.profileUrl}"`);
    expect(email.html).toContain("Rellenar mi ficha");
  });

  it("escapa HTML en los nombres", () => {
    const email = buildCoachProfileEmail({
      ...base,
      clubName: "<script>x</script>",
      recipientName: "<b>Ángel</b>",
    });
    expect(email.html).not.toContain("<script>");
    expect(email.html).not.toContain("<b>Ángel</b>");
  });

  it("permite responder al gestor", () => {
    const email = buildCoachProfileEmail({
      ...base,
      replyTo: "gestor@club.es",
    });
    expect(email.replyTo).toBe("gestor@club.es");
  });
});
