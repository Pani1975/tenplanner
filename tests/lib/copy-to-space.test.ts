import { beforeEach, describe, expect, it, vi } from "vitest";

const getActiveWorkClubId = vi.fn();
vi.mock("@/lib/clubs", () => ({
  getActiveWorkClubId: (userId: string) => getActiveWorkClubId(userId),
}));

const { omitKeys, resolveCopyDestination } =
  await import("@/lib/copy-to-space");

const ME = "user-me";
const OTHER = "user-other";
const CLUB = "club-1";

describe("resolveCopyDestination", () => {
  beforeEach(() => {
    getActiveWorkClubId.mockReset();
  });

  it("copia de la Biblioteca al espacio particular si no se trabaja como club", async () => {
    getActiveWorkClubId.mockResolvedValue(null);
    const res = await resolveCopyDestination(
      { isPublic: true, createdBy: null, clubId: null },
      "active",
      ME
    );
    expect(res).toEqual({ ok: true, clubId: null });
  });

  it("copia de la Biblioteca al club del modo de trabajo", async () => {
    getActiveWorkClubId.mockResolvedValue(CLUB);
    const res = await resolveCopyDestination(
      { isPublic: true, createdBy: OTHER, clubId: null },
      "active",
      ME
    );
    expect(res).toEqual({ ok: true, clubId: CLUB });
  });

  it("no deja copiar contenido privado de otro como si fuera de la Biblioteca", async () => {
    const res = await resolveCopyDestination(
      { isPublic: false, createdBy: OTHER, clubId: CLUB },
      "active",
      ME
    );
    expect(res.ok).toBe(false);
  });

  it("el autor puede pasar a su espacio particular lo que creó en el club", async () => {
    const res = await resolveCopyDestination(
      { isPublic: false, createdBy: ME, clubId: CLUB },
      "particular",
      ME
    );
    expect(res).toEqual({ ok: true, clubId: null });
  });

  it("un monitor no puede llevarse a su particular lo que creó otro en el club", async () => {
    const res = await resolveCopyDestination(
      { isPublic: false, createdBy: OTHER, clubId: CLUB },
      "particular",
      ME
    );
    expect(res.ok).toBe(false);
  });

  it("a particular solo desde un club", async () => {
    const res = await resolveCopyDestination(
      { isPublic: false, createdBy: ME, clubId: null },
      "particular",
      ME
    );
    expect(res.ok).toBe(false);
  });
});

describe("omitKeys", () => {
  it("quita las claves indicadas sin tocar el original", () => {
    const src = { id: "1", name: "Clase", createdAt: new Date(0) };
    expect(omitKeys(src, ["id", "createdAt"])).toEqual({ name: "Clase" });
    expect(src.id).toBe("1");
  });
});
