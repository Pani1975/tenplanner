import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { getUser: mockGetUser } })),
}));

// La capa de datos se sustituye: aquí se prueba la protección, la
// validación y la traducción de errores de las rutas.
vi.mock("@/lib/tournaments/server", async () => {
  class TournamentError extends Error {
    constructor(
      public code: string,
      public status: number,
      public detail?: unknown
    ) {
      super(code);
    }
  }
  return {
    TournamentError,
    getOrganizer: vi.fn(async (userId: string) => ({
      userId,
      clubId: null,
      sport: "tenis",
    })),
    listTournaments: vi.fn(async () => []),
    createTournament: vi.fn(async () => ({ id: "t1" })),
    getTournamentDetail: vi.fn(),
    updateTournament: vi.fn(),
    listCandidates: vi.fn(),
    addSchoolEntries: vi.fn(async () => ({ added: [], skipped: [] })),
    addManualEntry: vi.fn(),
    updateEntry: vi.fn(async () => ({ promoted: [] })),
    generateDraw: vi.fn(async () => []),
    recordResult: vi.fn(),
    clearMatchResult: vi.fn(),
  };
});

const server = await import("@/lib/tournaments/server");
const ID = "11111111-1111-4111-8111-111111111111";
const ctx = <P extends Record<string, string>>(params: P) => ({
  params: Promise.resolve(params),
});
const post = (body: unknown) =>
  new Request("http://localhost/api/tournaments", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("API de torneos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("sin sesión: 401 y no toca datos", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const { GET } = await import("@/app/api/tournaments/route");
    const res = await GET();
    expect(res.status).toBe(401);
    expect(server.listTournaments).not.toHaveBeenCalled();
  });

  it("crear: valida y usa el organizador de la sesión", async () => {
    const { POST } = await import("@/app/api/tournaments/route");
    const res = await POST(
      post({
        name: "Torneo de Navidad",
        startDate: "2026-12-20",
        modality: "singles",
        format: "knockout",
      })
    );
    expect(res.status).toBe(201);
    expect(server.createTournament).toHaveBeenCalledWith(
      expect.objectContaining({ userId: "user-1" }),
      expect.objectContaining({ name: "Torneo de Navidad", bestOf: 3 })
    );
  });

  it("crear: datos no válidos → 400", async () => {
    const { POST } = await import("@/app/api/tournaments/route");
    expect((await POST(post({ name: "x" }))).status).toBe(400);
    expect((await POST(post("{no es json"))).status).toBe(400);
    expect(server.createTournament).not.toHaveBeenCalled();
  });

  it("id que no es uuid → 404 sin consultar", async () => {
    const { GET } = await import("@/app/api/tournaments/[id]/route");
    const res = await GET(new Request("http://localhost"), ctx({ id: "abc" }));
    expect(res.status).toBe(404);
    expect(server.getTournamentDetail).not.toHaveBeenCalled();
  });

  it("torneo de otro organizador → 404 (error de la capa de datos)", async () => {
    vi.mocked(server.getTournamentDetail).mockRejectedValueOnce(
      new server.TournamentError("not_found", 404)
    );
    const { GET } = await import("@/app/api/tournaments/[id]/route");
    const res = await GET(new Request("http://localhost"), ctx({ id: ID }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ error: "not_found" });
  });

  it("añadir alumnos: pasa la lista a la capa de datos", async () => {
    const { POST } = await import("@/app/api/tournaments/[id]/entries/route");
    const res = await POST(
      post({
        kind: "school",
        items: [{ studentId: ID }],
        consentDeclared: true,
      }),
      ctx({ id: ID })
    );
    expect(res.status).toBe(201);
    expect(server.addSchoolEntries).toHaveBeenCalledWith(
      expect.anything(),
      ID,
      expect.objectContaining({ consentDeclared: true })
    );
    expect(server.addManualEntry).not.toHaveBeenCalled();
  });

  it("cuadro: avisa de inscripciones sin consentimiento con 409", async () => {
    vi.mocked(server.generateDraw).mockRejectedValueOnce(
      new server.TournamentError("pending_consent", 409, { count: 2 })
    );
    const { POST } = await import("@/app/api/tournaments/[id]/draw/route");
    const res = await POST(post({}), ctx({ id: ID }));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "pending_consent",
      detail: { count: 2 },
    });
    expect(server.generateDraw).toHaveBeenCalledWith(expect.anything(), ID, {
      excludePending: false,
    });
  });

  it("resultado: rechaza marcador en texto libre", async () => {
    const { PATCH } =
      await import("@/app/api/tournaments/[id]/matches/[matchId]/route");
    const res = await PATCH(
      post({ resultType: "normal", score: "6-4 6-3" }),
      ctx({ id: ID, matchId: ID })
    );
    expect(res.status).toBe(400);
    expect(server.recordResult).not.toHaveBeenCalled();
  });

  it("error inesperado → 500 sin detalles internos", async () => {
    vi.mocked(server.listTournaments).mockRejectedValueOnce(
      new Error("connection refused at 10.0.0.1")
    );
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { GET } = await import("@/app/api/tournaments/route");
    const res = await GET();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: "server_error" });
    spy.mockRestore();
  });
});
