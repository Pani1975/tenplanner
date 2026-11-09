import { beforeAll, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= "anon-key";
});

async function run(url: string) {
  const { proxy } = await import("@/proxy");
  return proxy(new NextRequest(url));
}

describe("proxy: vuelta de Google a la portada", () => {
  it("reenvía /?code=… al callback con los mismos parámetros", async () => {
    const res = await run(
      "https://www.tenplanner.com/?code=abc123&next=%2Fdashboard"
    );
    expect(res.status).toBe(307);
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/auth/callback");
    expect(location.searchParams.get("code")).toBe("abc123");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });

  it("si Google devuelve un error, lleva al login con aviso", async () => {
    const res = await run(
      "https://www.tenplanner.com/?error=access_denied&error_description=cancelado"
    );
    const location = new URL(res.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("error")).toBe("auth_callback_failed");
  });

  it("la portada sin código se muestra normal", async () => {
    const res = await run("https://www.tenplanner.com/");
    expect(res.headers.get("location")).toBeNull();
  });
});
