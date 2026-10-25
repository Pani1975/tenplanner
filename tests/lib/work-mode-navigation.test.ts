import { afterEach, describe, expect, it, vi } from "vitest";

import { goAfterModeChange } from "@/lib/work-mode-navigation";
import { MODE_ADMIN, MODE_MANAGEMENT } from "@/lib/work-mode-options";

function setup() {
  const assign = vi.fn();
  vi.stubGlobal("window", { location: { assign } });
  const router = { refresh: vi.fn() };
  return { assign, router };
}

afterEach(() => vi.unstubAllGlobals());

describe("goAfterModeChange", () => {
  it("entrar en gestión o administrador recarga en su página de inicio", () => {
    const a = setup();
    goAfterModeChange(a.router, "club-1", MODE_MANAGEMENT);
    expect(a.assign).toHaveBeenCalledWith("/gestion");
    const b = setup();
    goAfterModeChange(b.router, "club-1", MODE_ADMIN);
    expect(b.assign).toHaveBeenCalledWith("/informes");
  });

  it("salir de gestión o administrador vuelve al Inicio", () => {
    const a = setup();
    goAfterModeChange(a.router, MODE_MANAGEMENT, "club-1");
    expect(a.assign).toHaveBeenCalledWith("/dashboard");
  });

  it("entre club y particular solo refresca", () => {
    const a = setup();
    goAfterModeChange(a.router, "club-1", "particular");
    expect(a.assign).not.toHaveBeenCalled();
    expect(a.router.refresh).toHaveBeenCalled();
  });
});
