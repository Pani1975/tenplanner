import { sql } from "drizzle-orm";
import { db } from "@/db";

/**
 * "Solo familia": el usuario tiene acceso de familia activo (es contacto de
 * algún alumno) —o se registró como familia/jugador y aún espera la
 * invitación del club— y no trabaja en Ten Planner: no es miembro activo de
 * ningún club, no tiene alumnos, grupos ni sesiones propios y no es
 * administrador. A estos usuarios se les muestra el panel de familias.
 * Un monitor que además es padre sigue viendo la app completa.
 */
export async function isFamilyOnlyUser(
  userId: string,
  registeredAsFamily = false
): Promise<boolean> {
  const rows = await db.execute<{ family_only: boolean }>(sql`
    select
      (exists (select 1 from student_guardians sg
               where sg.user_id = ${userId} and sg.revoked_at is null)
       or ${registeredAsFamily}::boolean)
      and not exists (select 1 from club_members cm
                      where cm.user_id = ${userId} and cm.status = 'active')
      and not exists (select 1 from students s where s.coach_id = ${userId})
      and not exists (select 1 from groups g where g.coach_id = ${userId})
      and not exists (select 1 from sessions se where se.user_id = ${userId})
      and not coalesce((select u.is_admin from users u where u.id = ${userId}), false)
      as family_only
  `);
  return !!rows[0]?.family_only;
}
