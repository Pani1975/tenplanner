// Vincula las actividades de las clases importadas con ejercicios de la
// biblioteca pública o del propio monitor/club:
//   1. Candidatos por actividad: buscador de Ejercicios (palabras clave) más
//      ejercicios con las mismas etiquetas (golpe, tipo, aspecto), dando
//      prioridad al nivel de la clase.
//   2. Una segunda llamada a la IA elige, con la descripción del monitor, el
//      candidato que encaja o ninguno (choose-exercises.ts).
// Solo propone: el monitor confirma en la revisión.

import { and, asc, eq, or, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { exercises } from "@/db/schema";
import { exerciseOwnOrClubCondition } from "@/lib/exercise-access";
import {
  exerciseSearchCondition,
  exerciseSearchNameRank,
} from "@/lib/exercises/search";
import {
  MAX_CANDIDATES,
  applyChoices,
  buildChoicePrompt,
  collectActivities,
  type AiChoices,
  type Candidate,
} from "@/lib/import/choose-exercises";
import {
  searchQueriesFor,
  type ImportedClass,
  type ImportedClassItem,
} from "@/lib/import/schema";

/** Tope de consultas a la base por importación. */
const MAX_QUERIES = 120;
const PER_QUERY = 5;

type Row = Candidate & { inName: boolean };

const candidateFields = {
  id: exercises.id,
  name: exercises.name,
  description: exercises.description,
  durationMinutes: exercises.durationMinutes,
  golpes: exercises.golpes,
  niveles: exercises.niveles,
};

function textArray(values: string[]): SQL {
  return sql`ARRAY[${sql.join(
    values.map((v) => sql`${v}`),
    sql`, `
  )}]::text[]`;
}

function levelRank(levels: string[] | null): SQL {
  return levels?.length
    ? sql`case when jsonb_exists_any(coalesce(${exercises.niveles}, '[]'::jsonb), ${textArray(levels)}) then 0 else 1 end`
    : sql`0`;
}

function toRow(r: {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number | null;
  golpes: string[] | null;
  niveles: string[] | null;
  rank?: number;
}): Row {
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    durationMinutes: r.durationMinutes,
    golpes: r.golpes ?? [],
    niveles: r.niveles ?? [],
    inName: Number(r.rank ?? 1) === 0,
  };
}

/** Llama a la IA con CHOOSE_SYSTEM y el prompt; la pone la ruta. */
export type ChooseFn = (prompt: string) => Promise<AiChoices>;

export async function linkClassItemsToLibrary(
  classes: ImportedClass[],
  userId: string,
  sport: string,
  choose: ChooseFn | null
): Promise<ImportedClass[]> {
  const visible = and(
    eq(exercises.sport, sport as typeof exercises.sport._.data),
    or(eq(exercises.isGlobal, true), exerciseOwnOrClubCondition(userId))
  );
  let budget = MAX_QUERIES;
  let errors = 0;
  const cache = new Map<string, Promise<Row[]>>();
  const run = (key: string, q: () => Promise<Row[]>) => {
    let hit = cache.get(key);
    if (!hit) {
      if (budget <= 0) return Promise.resolve([] as Row[]);
      budget -= 1;
      hit = q().catch((e: unknown) => {
        errors += 1;
        if (errors === 1) {
          console.error(
            "[import-text] búsqueda en biblioteca falló",
            e instanceof Error ? e.message.slice(0, 200) : "desconocido"
          );
        }
        return [] as Row[];
      });
      cache.set(key, hit);
    }
    return hit;
  };

  const byKeyword = (term: string, levels: string[] | null) =>
    run(`k:${term}|${levels?.join(",")}`, async () => {
      const cond = exerciseSearchCondition(term);
      const rank = exerciseSearchNameRank(term);
      if (!cond || !rank) return [];
      const rows = await db
        .select({ ...candidateFields, rank: sql<number>`${rank}` })
        .from(exercises)
        .where(and(cond, visible))
        .orderBy(rank, levelRank(levels), sql`length(${exercises.name})`)
        .limit(PER_QUERY);
      return rows.map(toRow);
    });

  const byTags = (item: ImportedClassItem, levels: string[] | null) => {
    const { golpes, tipo, aspecto } = item.tags;
    const conds: SQL[] = [];
    if (golpes.length) {
      conds.push(
        sql`jsonb_exists_any(coalesce(${exercises.golpes}::jsonb, '[]'::jsonb), ${textArray(golpes)})`
      );
    }
    if (tipo) {
      conds.push(
        sql`jsonb_exists(coalesce(${exercises.tiposActividad}, '[]'::jsonb), ${tipo})`
      );
    } else if (aspecto) {
      conds.push(
        sql`jsonb_exists(coalesce(${exercises.aspectosJuego}, '[]'::jsonb), ${aspecto})`
      );
    }
    if (conds.length === 0) return Promise.resolve([] as Row[]);
    return run(
      `t:${golpes.join(",")}|${tipo}|${aspecto}|${levels?.join(",")}`,
      async () => {
        const rows = await db
          .select(candidateFields)
          .from(exercises)
          .where(and(visible, ...conds))
          .orderBy(levelRank(levels), asc(exercises.name))
          .limit(PER_QUERY);
        return rows.map(toRow);
      }
    );
  };

  // 1. Candidatos por actividad.
  const pool = new Map<ImportedClassItem, Row[]>();
  for (const c of classes) {
    for (const b of c.blocks) {
      for (const item of b.items) {
        const queries = searchQueriesFor(item);
        if (queries.length === 0) continue; // descanso, pausa…
        const found: Row[] = [];
        const push = (rows: Row[]) => {
          for (const r of rows) {
            if (!found.some((f) => f.id === r.id)) found.push(r);
          }
        };
        for (const { query } of queries) {
          push(await byKeyword(query, c.niveles));
          if (found.length >= MAX_CANDIDATES - 2) break;
        }
        push(await byTags(item, c.niveles));
        pool.set(item, found.slice(0, MAX_CANDIDATES));
      }
    }
  }

  // 2. La IA elige con la descripción del monitor.
  const activities = collectActivities(classes, (it) => pool.get(it) ?? []);
  let chosen = 0;
  let mode = "ninguna";
  if (activities.length > 0 && choose) {
    try {
      const levels = classes.flatMap((c) => c.niveles ?? []);
      const ai = await choose(
        buildChoicePrompt(activities, levels.length ? [...new Set(levels)] : null)
      );
      chosen = applyChoices(activities, ai);
      mode = "ia";
    } catch (e) {
      console.error(
        "[import-text] elección de ejercicios falló",
        e instanceof Error ? e.name : "desconocido"
      );
    }
  }
  if (mode !== "ia") {
    // Sin IA: se sugiere lo encontrado y solo se preselecciona si el nombre
    // del ejercicio contiene las palabras clave.
    for (const a of activities) {
      const rows = pool.get(a.item) ?? [];
      a.item.suggestions = rows.slice(0, 5).map((r) => ({
        id: r.id,
        name: r.name,
        durationMinutes: r.durationMinutes,
      }));
      const strong = searchQueriesFor(a.item)[0]?.strong ?? false;
      a.item.exerciseId = strong && rows[0]?.inName ? rows[0].id : null;
      if (a.item.exerciseId) chosen += 1;
    }
    if (activities.length > 0) mode = choose ? "palabras (IA falló)" : "palabras";
  }

  // Solo recuentos (sin textos) para poder revisar en los logs.
  console.info(
    "[import-text] biblioteca",
    `actividades_con_candidatos=${activities.length}`,
    `elegidas=${chosen}`,
    `modo=${mode}`,
    `errores_busqueda=${errors}`
  );
  return classes;
}
