import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: mockGetUser },
  })),
}));

import { config, proxy } from "@/proxy";

function request(path: string) {
  return new NextRequest(new URL(path, "https://tenplanner.com"));
}

describe("proxy auth routing", () => {
  beforeEach(() => {
    mockGetUser.mockReset();
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  it("redirects logged-out visitors on app pages to /login", async () => {
    const res = await proxy(request("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://tenplanner.com/login");
  });

  it("redirects nested app pages too", async () => {
    const res = await proxy(request("/students/123"));
    expect(res.headers.get("location")).toBe("https://tenplanner.com/login");
  });

  it("lets unknown paths through so the router can return a 404", async () => {
    const res = await proxy(request("/no-existe"));
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("x-middleware-next")).toBe("1");
  });

  it("does not treat a lookalike prefix as an app page", async () => {
    const res = await proxy(request("/dashboarding"));
    expect(res.headers.get("location")).toBeNull();
  });

  it("still answers 401 for unauthenticated API calls", async () => {
    const res = await proxy(request("/api/students"));
    expect(res.status).toBe(401);
  });
});

describe("proxy matcher", () => {
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it.each([
    "/sw.js",
    "/manifest.webmanifest",
    "/icon-192x192.png",
    "/apple-icon.png",
    "/opengraph-image",
    "/robots.txt",
    "/sitemap.xml",
  ])("skips %s", (path) => {
    expect(matcher.test(path)).toBe(false);
  });

  it.each(["/", "/dashboard", "/no-existe", "/api/students"])(
    "runs on %s",
    (path) => {
      expect(matcher.test(path)).toBe(true);
    }
  );
});
