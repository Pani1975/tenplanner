// Prueba de integración contra la base de PRUEBAS (nunca producción).
// Se ejecuta solo con TOURNAMENTS_DB_IT=1 y una DATABASE_URL del proyecto
// de pruebas (xiqppjupqrfpdbdcrtzs). Crea torneos del usuario de prueba y
// los borra al terminar. Ejemplo:
//   TOURNAMENTS_DB_IT=1 node --env-file=../app/.env.local \
//     node_modules/vitest/vitest.mjs run tests/integration
import { afterAll, describe, expect, it, vi } from "vitest";

const TEST_PROJECT = "xiqppjupqrfpdbdcrtzs";
const enabled =
  process.env.TOURNAMENTS_DB_IT === "1" &&
  (process.env.DATABASE_URL ?? "").includes(TEST_PROJECT);

const TEST_EMAIL = "monitor.prueba@tenplanner.test";

if (!enabled) {
  it.skip("torneos contra la base de pruebas (TOURNAMENTS_DB_IT=1)", () => {});
} else
  describe("torneos contra la base de pruebas", async () => {
    vi.setConfig({ testTimeout: 120_000, hookTimeout: 60_000 });
    const { db } = await import("@/db");
    const schema = await import("@/db/schema");
    const { and, eq, inArray, ne } = await import("drizzle-orm");
    const s = await import("@/lib/tournaments/server");

    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, TEST_EMAIL))
      .limit(1);
    const o: import("@/lib/tournaments/server").Organizer = {
      userId: user.id,
      clubId: null,
      sport: "tenis",
    };
    const created: string[] = [];

    afterAll(async () => {
      if (created.length) {
        await db
          .delete(schema.tournaments)
          .where(inArray(schema.tournaments.id, created));
      }
    });

    const futureDay = (d: number) =>
      new Date(Date.now() + d * 86_400_000).toISOString().slice(0, 10);

    it("eliminatoria: alumnos, lista de espera, externo, cuadro y resultados", async () => {
      const t = await s.createTournament(o, {
        name: "IT eliminatoria",
        description: null,
        startDate: futureDay(10),
        maxEntries: 4,
        modality: "singles",
        format: "knockout",
        bestOf: 3,
        gamesPerSet: 6,
        finalSet: "super_tiebreak",
      });
      created.push(t.id);
      expect(t).toMatchObject({
        ownerType: "coach",
        coachId: user.id,
        clubId: null,
      });
      expect(t.slug).toMatch(/^it-eliminatoria-[a-z2-9]{6}$/);

      // Otro organizador no lo ve.
      await expect(
        s.getTournament({ ...o, userId: crypto.randomUUID() }, t.id)
      ).rejects.toMatchObject({ code: "not_found" });

      // Selector: grupos y alumnos de su escuela, sin contacto.
      const cand = await s.listCandidates(o, t.id);
      const group = cand.groups.find((g) => g.name === "Grupo prueba")!;
      expect(group.studentIds.length).toBe(4);
      expect(Object.keys(cand.students[0])).not.toContain("email");
      const others = cand.students
        .filter((x) => !group.studentIds.includes(x.id))
        .slice(0, 2);

      // Grupo entero + dos sueltos: 4 plazas → 4 confirmados y 2 en espera.
      const r1 = await s.addSchoolEntries(o, t.id, {
        kind: "school",
        items: [
          ...group.studentIds.map((id) => ({
            studentId: id,
            groupId: group.id,
          })),
          ...others.map((x) => ({ studentId: x.id })),
        ],
        consentDeclared: true,
      });
      expect(r1.added.map((a) => a.status)).toEqual([
        "confirmed",
        "confirmed",
        "confirmed",
        "confirmed",
        "waitlist",
        "waitlist",
      ]);

      // Sin duplicados.
      const r2 = await s.addSchoolEntries(o, t.id, {
        kind: "school",
        items: [{ studentId: group.studentIds[0] }],
        consentDeclared: true,
      });
      expect(r2).toEqual({
        added: [],
        skipped: [{ studentId: group.studentIds[0], reason: "duplicate" }],
      });

      // Alumno de otra escuela: rechazado.
      const [foreign] = await db
        .select({ id: schema.students.id })
        .from(schema.students)
        .where(ne(schema.students.coachId, user.id))
        .limit(1);
      if (foreign) {
        await expect(
          s.addSchoolEntries(o, t.id, {
            kind: "school",
            items: [{ studentId: foreign.id }],
            consentDeclared: true,
          })
        ).rejects.toMatchObject({ code: "student_not_found" });
      }

      // Externo a mano, sin consentimiento: a la cola.
      const ext = await s.addManualEntry(o, t.id, {
        kind: "manual",
        player: {
          firstName: "Externa",
          lastName: "Prueba Torneo",
          email: "Externa@Ejemplo.test",
          isMinor: false,
          guardianName: null,
        },
        consentDeclared: false,
      });
      expect(ext.entry).toMatchObject({
        status: "waitlist",
        email: "externa@ejemplo.test",
        consentAt: null,
      });
      await expect(
        s.addManualEntry(o, t.id, {
          kind: "manual",
          player: {
            firstName: "Otra",
            lastName: "Vez",
            email: "externa@ejemplo.test",
            isMinor: false,
            guardianName: null,
          },
          consentDeclared: true,
        })
      ).rejects.toMatchObject({ code: "duplicate" });

      // Cancelar un confirmado: sube el primero de la lista de espera.
      const before = await s.getTournamentDetail(o, t.id);
      const firstConfirmed = before.entries.find(
        (e) => e.status === "confirmed"
      )!;
      const firstWaiting = before.entries.find((e) => e.status === "waitlist")!;
      const c = await s.updateEntry(o, t.id, firstConfirmed.id, {
        action: "cancel",
      });
      expect(c.promoted).toEqual([
        { id: firstWaiting.id, status: "confirmed" },
      ]);

      // Bajar plazas por debajo de las ocupadas: no.
      await expect(
        s.updateTournament(o, t.id, { maxEntries: 2 })
      ).rejects.toMatchObject({ code: "max_below_taken" });

      // Abrir y cerrar; cuadro.
      await s.updateTournament(o, t.id, { status: "open" });
      await expect(
        s.generateDraw(o, t.id, { excludePending: false })
      ).rejects.toMatchObject({
        code: "must_be_closed",
      });
      await s.updateTournament(o, t.id, { status: "closed" });
      const matches = await s.generateDraw(o, t.id, { excludePending: false });
      expect(matches).toHaveLength(3);
      const detail = await s.getTournamentDetail(o, t.id);
      expect(detail.tournament.status).toBe("in_progress");

      // Resultados: semis y final; el ganador avanza solo.
      const semis = matches.filter((m) => m.round === 1);
      const final = matches.find((m) => m.round === 2)!;
      await s.recordResult(o, t.id, semis[0].id, {
        resultType: "normal",
        score: {
          sets: [
            { a: 6, b: 4 },
            { a: 6, b: 3 },
          ],
        },
        courtLabel: "Pista 1",
      });
      await s.recordResult(o, t.id, semis[1].id, {
        resultType: "normal",
        score: {
          sets: [
            { a: 4, b: 6 },
            { a: 6, b: 3 },
          ],
          superTiebreak: { a: 8, b: 10 },
        },
        courtLabel: null,
      });
      // Marcador no válido.
      await expect(
        s.recordResult(o, t.id, final.id, {
          resultType: "normal",
          score: { sets: [{ a: 6, b: 5 }] },
          courtLabel: null,
        })
      ).rejects.toMatchObject({ code: "invalid_set" });

      const [finalRow] = await db
        .select()
        .from(schema.tournamentMatches)
        .where(eq(schema.tournamentMatches.id, final.id));
      expect(finalRow.entryAId).toBe(semis[0].entryAId);
      expect(finalRow.entryBId).toBe(semis[1].entryBId);

      await s.recordResult(o, t.id, final.id, {
        resultType: "walkover",
        winner: "b",
        courtLabel: null,
      });
      // Ya jugada la final, no se puede cambiar una semi.
      await expect(
        s.clearMatchResult(o, t.id, semis[0].id)
      ).rejects.toMatchObject({
        code: "next_already_played",
      });
      await s.updateTournament(o, t.id, { status: "finished" });
    });

    it("liguilla: calendario y resultados", async () => {
      const t = await s.createTournament(o, {
        name: "IT liguilla",
        description: null,
        startDate: futureDay(12),
        modality: "singles",
        format: "round_robin",
        bestOf: 1,
        gamesPerSet: 4,
        finalSet: "full",
      });
      created.push(t.id);
      const cand = await s.listCandidates(o, t.id);
      await s.addSchoolEntries(o, t.id, {
        kind: "school",
        items: cand.students.slice(0, 3).map((x) => ({ studentId: x.id })),
        consentDeclared: false,
      });
      await s.updateTournament(o, t.id, { status: "open" });
      await s.updateTournament(o, t.id, { status: "closed" });
      // Sin consentimiento: avisa.
      await expect(
        s.generateDraw(o, t.id, { excludePending: false })
      ).rejects.toMatchObject({
        code: "pending_consent",
        detail: { count: 3 },
      });

      const d = await s.getTournamentDetail(o, t.id);
      for (const e of d.entries) {
        await s.updateEntry(o, t.id, e.id, { action: "declare_consent" });
      }
      const after = await s.getTournamentDetail(o, t.id);
      expect(after.entries.every((e) => e.status === "confirmed")).toBe(true);
      expect(after.entries[0]).toMatchObject({
        consentMethod: "coach_declared",
        consentVersion: "torneo-v1",
        consentByUserId: user.id,
      });

      const ms = await s.generateDraw(o, t.id, { excludePending: false });
      expect(ms).toHaveLength(3);
      await s.recordResult(o, t.id, ms[0].id, {
        resultType: "normal",
        score: { sets: [{ a: 4, b: 2 }] },
        courtLabel: null,
      });
      const [row] = await db
        .select()
        .from(schema.tournamentMatches)
        .where(
          and(
            eq(schema.tournamentMatches.id, ms[0].id),
            eq(schema.tournamentMatches.status, "played")
          )
        );
      expect(row.winnerEntryId).toBe(ms[0].entryAId);
    });
  });
