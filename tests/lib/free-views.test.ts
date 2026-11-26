import { describe, expect, it } from "vitest";
import {
  countView,
  FREE_VIEWS_LIMIT,
  isBotUserAgent,
  isLibraryPath,
  viewKey,
} from "@/lib/free-views";

describe("límite de visitas sin registro", () => {
  it("deja ver 10 páginas distintas y bloquea la 11", () => {
    let raw: string | undefined;
    for (let i = 0; i < FREE_VIEWS_LIMIT; i++) {
      const r = countView(raw, viewKey(`/exercises/${i}`, ""));
      expect(r.allowed).toBe(true);
      raw = r.views.join(".");
    }
    expect(countView(raw, viewKey("/classes/x", "")).allowed).toBe(false);
  });
  it("recargar una página ya vista no gasta cupo, ni siquiera con el límite alcanzado", () => {
    let raw: string | undefined;
    for (let i = 0; i < FREE_VIEWS_LIMIT; i++)
      raw = countView(raw, viewKey(`/exercises/${i}`, "")).views.join(".");
    const again = countView(raw, viewKey("/exercises/3", ""));
    expect(again.allowed).toBe(true);
    expect(again.changed).toBe(false);
  });
  it("ejercicios, clases y listas cuentan juntos", () => {
    const keys = ["/exercises", "/classes", "/exercises/a", "/classes/b"].map((p) => viewKey(p, ""));
    expect(new Set(keys).size).toBe(4);
    expect(viewKey("/exercises", "page=2")).not.toBe(viewKey("/exercises", ""));
  });
  it("una cookie manipulada no rompe nada", () => {
    expect(countView("%%%..<script>", "abc").allowed).toBe(true);
  });
  it("solo vigila la biblioteca y no la API", () => {
    expect(isLibraryPath("/exercises")).toBe(true);
    expect(isLibraryPath("/classes/123")).toBe(true);
    expect(isLibraryPath("/api/exercises")).toBe(false);
    expect(isLibraryPath("/exercises-viejo")).toBe(false);
  });
  it("reconoce buscadores", () => {
    expect(isBotUserAgent("Mozilla/5.0 (compatible; Googlebot/2.1)")).toBe(true);
    expect(isBotUserAgent("Mozilla/5.0 (Windows NT 10.0) Chrome/120")).toBe(false);
  });
});
