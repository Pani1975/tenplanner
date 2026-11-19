import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/tournaments/public", () => ({
  registerPublic: vi.fn(async () => ({
    status: "confirmed",
    waitlistPosition: null,
    cancelToken: "tok_abcdefghijklmnopqrstuvwxyz",
    notifyEmail: "ana@x.com",
    playerName: "Ana R.",
    tournament: { name: "Open", slug: "open-abc123", startDate: "2026-12-20" },
  })),
  cancelByToken: vi.fn(),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ sent: false, reason: "not_configured" })),
  getSiteUrl: () => "https://tenplanner.com",
  escapeHtml: (s: string) => s,
}));

const pub = await import("@/lib/tournaments/public");
const email = await import("@/lib/email");
const { POST } = await import("@/app/api/public/torneos/[slug]/route");

const ctx = { params: Promise.resolve({ slug: "open-abc123" }) };
let ip = 0;
const req = (body: unknown) =>
  new Request("http://localhost/api/public/torneos/open-abc123", {
    method: "POST",
    // Una IP distinta por prueba para no chocar con el límite de envíos.
    headers: { "x-forwarded-for": `10.0.0.${++ip}` },
    body: JSON.stringify(body),
  });
const valid = {
  player: { firstName: "Ana", lastName: "Ruiz", email: "ana@x.com" },
  consent: true,
};

describe("inscripción pública", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sin consentimiento RGPD → 400", async () => {
    const res = await POST(req({ ...valid, consent: false }), ctx);
    expect(res.status).toBe(400);
    expect(pub.registerPublic).not.toHaveBeenCalled();
  });

  it("trampa para robots rellena → 400", async () => {
    const res = await POST(req({ ...valid, website: "http://spam" }), ctx);
    expect(res.status).toBe(400);
    expect(pub.registerPublic).not.toHaveBeenCalled();
  });

  it("menor sin tutor → 400", async () => {
    const res = await POST(
      req({
        ...valid,
        player: { firstName: "Leo", lastName: "R", isMinor: true },
      }),
      ctx
    );
    expect(res.status).toBe(400);
  });

  it("válida: 201, manda el correo con el enlace de cancelar y no devuelve el token", async () => {
    const res = await POST(req(valid), ctx);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toEqual({
      data: { status: "confirmed", waitlistPosition: null, emailSent: false },
    });
    expect(JSON.stringify(body)).not.toContain("tok_");
    const mail = vi.mocked(email.sendEmail).mock.calls[0][0];
    expect(mail.to).toBe("ana@x.com");
    expect(mail.text).toContain(
      "https://tenplanner.com/t/open-abc123/cancelar?token=tok_abcdefghijklmnopqrstuvwxyz"
    );
  });

  it("slug raro → 404 sin tocar datos", async () => {
    const res = await POST(req(valid), {
      params: Promise.resolve({ slug: "../../etc" }),
    });
    expect(res.status).toBe(404);
    expect(pub.registerPublic).not.toHaveBeenCalled();
  });
});
