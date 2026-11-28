import { sql } from "drizzle-orm";
import { db } from "@/db";

type Row = Record<string, unknown>;

function rowsOf(result: unknown): Row[] {
  if (Array.isArray(result)) return result as Row[];
  const rows = (result as { rows?: Row[] } | null)?.rows;
  return Array.isArray(rows) ? rows : [];
}

/**
 * Cuenta de acceso borrada y vuelta a registrar con el mismo correo: Supabase
 * le da otro id, pero su fila de `users` (con su club, ejercicios, clases,
 * grupos…) se queda con el id antiguo, y la fila nueva no se puede crear
 * porque el correo ya está usado. Resultado: entra sin nada suyo.
 *
 * Si `userId` no tiene fila en `users` y hay una con el mismo correo cuyo id
 * ya no existe en `auth.users` (la cuenta antigua), se pasa todo a `userId`:
 * se crea la fila nueva con los datos de la antigua, se cambian todas las
 * referencias (claves ajenas a users.id) y se borra la antigua. Todo en una
 * transacción. Nunca toca una fila cuya cuenta de acceso sigue existiendo.
 *
 * Devuelve true si ha unido las fichas.
 */
export async function relinkOrphanUserRow(
  userId: string,
  email: string
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const own = rowsOf(
      await tx.execute(sql`select 1 from public.users where id = ${userId}`)
    );
    if (own.length > 0) return false;

    const orphans = rowsOf(
      await tx.execute(sql`
        select u.id from public.users u
        where lower(u.email) = lower(${email})
          and u.id <> ${userId}
          and not exists (select 1 from auth.users a where a.id = u.id)
        for update`)
    );
    if (orphans.length !== 1) return false;
    const oldId = String(orphans[0].id);

    // Copia la fila antigua con el id nuevo (conserva su token de reservas)
    // y libera antes el correo y el token, que son únicos.
    await tx.execute(sql`
      create temp table relink_user_tmp on commit drop as
      select * from public.users where id = ${oldId}`);
    await tx.execute(sql`
      update public.users
      set email = email || '.relink-old', booking_token = null
      where id = ${oldId}`);
    await tx.execute(sql`
      update relink_user_tmp set id = ${userId}, email = ${email}`);
    await tx.execute(
      sql`insert into public.users select * from relink_user_tmp`
    );

    const fks = rowsOf(
      await tx.execute(sql`
        select tc.table_name, kcu.column_name
        from information_schema.table_constraints tc
        join information_schema.key_column_usage kcu
          on tc.constraint_name = kcu.constraint_name
         and tc.table_schema = kcu.table_schema
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_name = tc.constraint_name
        where tc.constraint_type = 'FOREIGN KEY'
          and tc.table_schema = 'public'
          and ccu.table_schema = 'public'
          and ccu.table_name = 'users'
          and ccu.column_name = 'id'
          and tc.table_name <> 'users'`)
    );
    for (const fk of fks) {
      const table = String(fk.table_name);
      const column = String(fk.column_name);
      await tx.execute(
        sql`update ${sql.identifier("public")}.${sql.identifier(table)}
            set ${sql.identifier(column)} = ${userId}
            where ${sql.identifier(column)} = ${oldId}`
      );
    }

    await tx.execute(sql`delete from public.users where id = ${oldId}`);
    console.info("Relinked orphan users row", { userId, oldId });
    return true;
  });
}
