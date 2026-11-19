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
    const pub = await import("@/lib/tournaments/public");
    const fam = await import("@/lib/tournaments/family");

    const [user] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, TEST_EMAIL))
      .limit(1);
    const o: import("@/lib/tournaments/server").Organizer = {
      userId: user.id,
      clubId: null,
      sport: "tenis",
      canSeeContacts: true,
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
      expect(r2).toMatchObject({
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

      // Sin permiso de contactos (monitor de club que no es su
      // administrador): ve la inscripción, pero no el correo.
      const hidden = await s.getTournamentDetail(
        { ...o, canSeeContacts: false },
        t.id
      );
      const extHidden = hidden.entries.find((e) => e.id === ext.entry.id)!;
      expect(extHidden).toMatchObject({
        firstName: "Externa",
        email: null,
        contactsHidden: true,
        cancelToken: null,
      });

      // Cancelar un confirmado: sube el primero de la lista de espera.
      const before = await s.getTournamentDetail(o, t.id);
      expect(before.entries.find((e) => e.id === ext.entry.id)!.email).toBe(
        "externa@ejemplo.test"
      );
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

    it("circuito: nuevo, reutilizado sin duplicar y solo del organizador", async () => {
      const name = `IT circuito ${crypto.randomUUID().slice(0, 6)}`;
      const base = {
        description: null,
        startDate: futureDay(15),
        modality: "singles" as const,
        format: "knockout" as const,
        bestOf: 3 as const,
        gamesPerSet: 6,
        finalSet: "super_tiebreak" as const,
      };
      const a = await s.createTournament(o, {
        ...base,
        name: "IT etapa 1",
        newCircuit: { name, season: "2026" },
      });
      created.push(a.id);
      expect(a.circuitId).not.toBeNull();
      // Mismo nombre con otras mayúsculas: reutiliza el circuito.
      const b = await s.createTournament(o, {
        ...base,
        name: "IT etapa 2",
        newCircuit: { name: name.toUpperCase(), season: "2026" },
      });
      created.push(b.id);
      expect(b.circuitId).toBe(a.circuitId);

      const circuits = await s.listCircuits(o);
      const mine = circuits.find((c) => c.id === a.circuitId)!;
      expect(mine).toMatchObject({ name, season: "2026", tournaments: 2 });

      const detail = await s.getTournamentDetail(o, b.id);
      expect(detail.tournament.circuit).toMatchObject({ name });

      // Otro monitor no puede meter un torneo en ese circuito.
      await expect(
        s.createTournament(
          { ...o, userId: crypto.randomUUID() },
          { ...base, name: "IT ajeno", circuitId: a.circuitId }
        )
      ).rejects.toMatchObject({ code: "circuit_not_found" });

      // Pasar a independiente.
      const u = await s.updateTournament(o, b.id, { circuitId: null });
      expect(u.tournament.circuitId).toBeNull();

      await db
        .delete(schema.tournamentCircuits)
        .where(eq(schema.tournamentCircuits.id, a.circuitId!));
    });

    it("público: inscripción por enlace, lista de espera, cancelar y privacidad", async () => {
      const base = {
        description: null,
        startDate: futureDay(20),
        modality: "singles" as const,
        format: "knockout" as const,
        bestOf: 3 as const,
        gamesPerSet: 6,
        finalSet: "super_tiebreak" as const,
      };
      const t = await s.createTournament(o, {
        ...base,
        name: "IT público",
        maxEntries: 2,
      });
      created.push(t.id);
      const reg = (first: string, last: string, email: string) =>
        pub.registerPublic(t.slug, {
          player: {
            firstName: first,
            lastName: last,
            email,
            isMinor: false,
            guardianName: null,
          },
          consent: true,
        });

      // En borrador no es público ni admite inscripciones.
      expect(await pub.getPublicTournament(t.slug)).toBeNull();
      await expect(reg("Ana", "Ruiz", "ana@it.test")).rejects.toMatchObject({
        code: "not_found",
      });
      await s.updateTournament(o, t.id, { status: "open" });

      const a = await reg("Ana", "Ruiz López", "ana@it.test");
      const b = await reg("Bea", "Sanz", "bea@it.test");
      const c = await reg("Carla", "Díaz", "carla@it.test");
      expect([a.status, b.status, c.status]).toEqual([
        "confirmed",
        "confirmed",
        "waitlist",
      ]);
      expect(c.waitlistPosition).toBe(1);
      await expect(reg("Otra", "Ana", "ANA@it.test")).rejects.toMatchObject({
        code: "duplicate",
      });
      // Menor: con el contacto del tutor (dos hermanos pueden compartirlo).
      const kid = (first: string) =>
        pub.registerPublic(t.slug, {
          player: {
            firstName: first,
            lastName: "Peña",
            isMinor: true,
            guardianName: "Marta Peña",
            guardianEmail: "marta@it.test",
          },
          consent: true,
        });
      expect((await kid("Leo")).status).toBe("waitlist");
      expect((await kid("Noa")).status).toBe("waitlist");

      // Página pública: cuenta la lista de espera y no hay contactos.
      const p = (await pub.getPublicTournament(t.slug))!;
      expect(p.registeredCount).toBe(5);
      expect(p.waitlistCount).toBe(3);
      expect(p.entrants).toEqual(["Ana R. L.", "Bea S."]);
      expect(p.waitlist).toEqual(["Carla D.", "Leo P.", "Noa P."]);
      const json = JSON.stringify(p);
      expect(json).not.toMatch(/@it\.test|marta|Ruiz López/i);

      // Cancelar con el enlace del correo: entra Carla (primera en espera).
      const r = await pub.cancelByToken(a.cancelToken);
      expect(r.alreadyCancelled).toBe(false);
      expect(r.promoted).toEqual([
        expect.objectContaining({
          email: "carla@it.test",
          playerName: "Carla D.",
        }),
      ]);
      const after = (await pub.getPublicTournament(t.slug))!;
      expect(after.entrants).toEqual(["Bea S.", "Carla D."]);
      expect((await pub.cancelByToken(a.cancelToken)).alreadyCancelled).toBe(
        true
      );
      expect(await pub.findByCancelToken("x".repeat(30))).toBeNull();

      // Cerrado: ya no admite inscripciones.
      await s.updateTournament(o, t.id, { status: "closed" });
      await expect(reg("Dani", "Gil", "dani@it.test")).rejects.toMatchObject({
        code: "registration_closed",
      });
    });

    it("circuito: puntos y clasificación general con torneos finalizados", async () => {
      const name = `IT ranking ${crypto.randomUUID().slice(0, 6)}`;
      const base = {
        description: null,
        startDate: futureDay(25),
        modality: "singles" as const,
        format: "knockout" as const,
        bestOf: 1 as const,
        gamesPerSet: 6,
        finalSet: "full" as const,
      };
      const cand = await s.listCandidates(
        o,
        (
          await s
            .createTournament(o, {
              ...base,
              name: "IT tmp",
            })
            .then((x) => {
              created.push(x.id);
              return x;
            })
        ).id
      );
      const four = cand.students.slice(0, 4).map((x) => x.id);

      async function play(label: string, order: string[]) {
        const t = await s.createTournament(o, {
          ...base,
          name: label,
          newCircuit: { name, season: null },
        });
        created.push(t.id);
        await s.addSchoolEntries(o, t.id, {
          kind: "school",
          items: order.map((id) => ({ studentId: id })),
          consentDeclared: true,
        });
        const d = await s.getTournamentDetail(o, t.id);
        // Cabezas de serie en el orden dado: gana siempre la mejor.
        for (const [i, id] of order.entries()) {
          const e = d.entries.find((x) => x.studentId === id)!;
          await s.updateEntry(o, t.id, e.id, { action: "seed", seed: i + 1 });
        }
        await s.updateTournament(o, t.id, { status: "open" });
        await s.updateTournament(o, t.id, { status: "closed" });
        let ms = await s.generateDraw(o, t.id, { excludePending: false });
        const seedOf = new Map(
          d.entries.map((e) => [e.id, order.indexOf(e.studentId!)])
        );
        for (let round = 1; round <= 2; round++) {
          for (const m of ms.filter((x) => x.round === round)) {
            const fresh = (await s.getTournamentDetail(o, t.id)).matches.find(
              (x) => x.id === m.id
            )!;
            const aWins =
              seedOf.get(fresh.entryAId!)! < seedOf.get(fresh.entryBId!)!;
            await s.recordResult(o, t.id, m.id, {
              resultType: "normal",
              score: { sets: [aWins ? { a: 6, b: 2 } : { a: 2, b: 6 }] },
              courtLabel: null,
            });
          }
          ms = (await s.getTournamentDetail(o, t.id)).matches;
        }
        await s.updateTournament(o, t.id, { status: "finished" });
        return t;
      }

      const t1 = await play("IT etapa A", four);
      await play("IT etapa B", [four[1], four[0], four[2], four[3]]);
      const det = await s.getTournamentDetail(o, t1.id);
      const circuit = await pub.getPublicCircuit(det.tournament.circuit!.slug);
      expect(circuit).not.toBeNull();
      const top = circuit!.standings.slice(0, 2);
      // Cada uno gana un torneo y es finalista en el otro: 170 puntos.
      expect(top.map((r) => r.points)).toEqual([170, 170]);
      expect(top.every((r) => r.tournaments === 2)).toBe(true);
      expect(JSON.stringify(circuit)).not.toMatch(/@|s:|e:/);

      await db
        .delete(schema.tournamentCircuits)
        .where(eq(schema.tournamentCircuits.id, det.tournament.circuitId!));
    });

    it("visibilidad: privado se oculta en público y lo ven las familias vinculadas", async () => {
      const t = await s.createTournament(o, {
        name: "IT privado",
        description: null,
        startDate: futureDay(30),
        modality: "singles",
        format: "knockout",
        bestOf: 3,
        gamesPerSet: 6,
        finalSet: "super_tiebreak",
        visibility: "private",
      });
      created.push(t.id);
      expect(t.visibility).toBe("private");
      await s.updateTournament(o, t.id, { status: "open" });

      // Privado: ni página pública ni inscripción por enlace.
      expect(await pub.getPublicTournament(t.slug)).toBeNull();
      await expect(
        pub.registerPublic(t.slug, {
          player: {
            firstName: "Ext",
            lastName: "Erno",
            email: "ext@it.test",
            isMinor: false,
            guardianName: null,
          },
          consent: true,
        })
      ).rejects.toMatchObject({ code: "registration_closed" });
      const asFamily = await pub.getPublicTournament(t.slug, {
        allowPrivate: true,
      });
      expect(asFamily?.visibility).toBe("private");
      expect(asFamily?.acceptsRegistrations).toBe(false);

      // Una cuenta vinculada a un alumno del monitor lo ve en su menú.
      const cand = await s.listCandidates(o, t.id);
      const student = cand.students[0];
      const [g] = await db
        .insert(schema.studentGuardians)
        .values({
          studentId: student.id,
          userId: user.id,
          name: "IT tutor",
          relationship: "madre",
        })
        .returning({ id: schema.studentGuardians.id });
      try {
        await s.addSchoolEntries(o, t.id, {
          kind: "school",
          items: [{ studentId: student.id }],
          consentDeclared: true,
        });
        const list = await fam.listFamilyTournaments(user.id);
        const mine = list.tournaments.find((x) => x.slug === t.slug);
        expect(mine).toMatchObject({
          visibility: "private",
          tab: "upcoming",
          mine: [{ status: "confirmed" }],
        });
        expect(
          await fam.getTournamentForFamily(user.id, t.slug)
        ).not.toBeNull();
        // Una cuenta sin vínculos no lo ve.
        expect(
          await fam.getTournamentForFamily(crypto.randomUUID(), t.slug)
        ).toBeNull();

        // Pasar a público: vuelve a verse con el enlace.
        await s.updateTournament(o, t.id, { visibility: "public" });
        expect(await pub.getPublicTournament(t.slug)).not.toBeNull();
      } finally {
        await db
          .delete(schema.studentGuardians)
          .where(eq(schema.studentGuardians.id, g.id));
      }
    });

    it("consentimiento de la familia: dobles, cada uno el suyo; y rechazar", async () => {
      const t = await s.createTournament(o, {
        name: "IT consentimiento familia",
        description: null,
        startDate: futureDay(35),
        modality: "doubles",
        format: "knockout",
        bestOf: 3,
        gamesPerSet: 6,
        finalSet: "super_tiebreak",
      });
      created.push(t.id);
      const cand = await s.listCandidates(o, t.id);
      const [a, b, c, d] = cand.students.map((x) => x.id);
      await s.addSchoolEntries(o, t.id, {
        kind: "school",
        items: [
          { studentId: a, partnerStudentId: b },
          { studentId: c, partnerStudentId: d },
        ],
        consentDeclared: false,
      });
      const guardians = await db
        .insert(schema.studentGuardians)
        .values(
          [a, b, c].map((studentId) => ({
            studentId,
            userId: user.id,
            name: "IT tutora",
            relationship: "madre",
          }))
        )
        .returning({ id: schema.studentGuardians.id });
      try {
        await s.updateTournament(o, t.id, { status: "open" });
        const entries = (await s.getTournamentDetail(o, t.id)).entries;
        const pair1 = entries.find((e) => e.studentId === a)!;
        const pair2 = entries.find((e) => e.studentId === c)!;
        expect(pair1.status).toBe("pending");

        // La familia ve los consentimientos que le tocan.
        const listed = (
          await fam.listFamilyTournaments(user.id)
        ).tournaments.find((x) => x.slug === t.slug)!;
        expect(listed.mine.filter((m) => m.needsConsent)).toHaveLength(3);

        // Una cuenta sin vínculo: como si no existiera.
        await expect(
          fam.familyRespond(crypto.randomUUID(), pair1.id, "player", "consent")
        ).rejects.toMatchObject({ code: "not_found" });
        // Sin vínculo con la pareja de la 2.ª inscripción (d).
        await expect(
          fam.familyRespond(user.id, pair2.id, "partner", "consent")
        ).rejects.toMatchObject({ code: "not_found" });

        // Primero el jugador: sigue pendiente; luego la pareja: confirmada.
        expect(
          (await fam.familyRespond(user.id, pair1.id, "player", "consent"))
            .status
        ).toBe("pending");
        expect(
          (await fam.familyRespond(user.id, pair1.id, "partner", "consent"))
            .status
        ).toBe("confirmed");
        const [row] = await db
          .select()
          .from(schema.tournamentEntries)
          .where(eq(schema.tournamentEntries.id, pair1.id));
        expect(row).toMatchObject({
          consentMethod: "guardian_link",
          partnerConsentMethod: "guardian_link",
          consentByName: "IT tutora",
          consentByUserId: user.id,
        });

        // Rechazar: se cancela la inscripción.
        expect(
          (await fam.familyRespond(user.id, pair2.id, "player", "decline"))
            .status
        ).toBe("cancelled");
      } finally {
        await db.delete(schema.studentGuardians).where(
          inArray(
            schema.studentGuardians.id,
            guardians.map((g) => g.id)
          )
        );
      }
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
