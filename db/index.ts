import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const dbUrl = process.env.DATABASE_URL!;
const isPooler = /:6543(\/|\?|$)/.test(dbUrl) || /pooler\./.test(dbUrl);

// En desarrollo, cada recarga en caliente vuelve a evaluar este módulo: sin
// reutilizar el cliente se abría un grupo de conexiones nuevo cada vez y se
// llenaba el límite del pooler de Supabase (EMAXCONNSESSION, 15 en modo
// sesión). En producción el módulo se evalúa una vez y esto no cambia nada.
const globalForDb = globalThis as unknown as {
  __tenplannerPg?: ReturnType<typeof postgres>;
};

const client =
  globalForDb.__tenplannerPg ??
  postgres(dbUrl, {
    prepare: isPooler ? false : undefined,
    max: isPooler ? 10 : undefined,
    idle_timeout: isPooler ? 20 : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__tenplannerPg = client;

export const db = drizzle(client, { schema });
