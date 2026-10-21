import { sql } from "drizzle-orm";
import { db } from "@/db";

// Informes de la plataforma (menú "Informes" de la cuenta de la plataforma):
// cuántos clubes, monitores, familias y jugadores hay dados de alta.
//
// Se cuentan todas las cuentas registradas (auth.users), también las de
// familias que aún no tienen fila en users.
// - Familias: cuentas registradas como familia/jugador o vinculadas a la
//   ficha de un alumno, que no trabajan como monitor (sin club activo ni
//   alumnos propios) — mismo criterio que lib/family.ts.
// - Monitores: el resto de cuentas, sin contar la de la plataforma.
// - Jugadores: fichas de alumno creadas por clubes y monitores.

export type ReportCount = { total: number; last30: number };

export type ClubReportRow = {
  id: string;
  name: string;
  createdAt: string;
  coaches: number;
  players: number;
};

export type PlatformReport = {
  clubs: ReportCount;
  coaches: ReportCount;
  families: ReportCount;
  players: ReportCount;
  library: { exercises: number; classes: number; objectives: number };
  clubRows: ClubReportRow[];
};

function n(v: unknown) {
  return Number(v ?? 0);
}

export async function loadPlatformReport(): Promise<PlatformReport> {
  const [counts] = await db.execute<Record<string, unknown>>(sql`
    with accounts as (
      select au.id, au.created_at,
        coalesce(u.is_platform_account, false) as platform,
        coalesce(
          (au.raw_user_meta_data->>'account_type') in ('familia', 'jugador'),
          false
        )
        or exists (select 1 from student_guardians sg
                   where sg.user_id = au.id and sg.revoked_at is null)
          as family_like,
        exists (select 1 from club_members cm
                where cm.user_id = au.id and cm.status = 'active')
        or exists (select 1 from students s where s.coach_id = au.id)
          as works_as_coach
      from auth.users au
      left join users u on u.id = au.id
      where au.deleted_at is null
    ),
    fam as (
      select id, created_at from accounts
      where family_like and not works_as_coach and not platform
    ),
    coaches as (
      select id, created_at from accounts
      where not platform and id not in (select id from fam)
    )
    select
      (select count(*) from clubs) as clubs,
      (select count(*) from clubs where created_at > now() - interval '30 days') as clubs30,
      (select count(*) from coaches) as coaches,
      (select count(*) from coaches where created_at > now() - interval '30 days') as coaches30,
      (select count(*) from fam) as families,
      (select count(*) from fam where created_at > now() - interval '30 days') as families30,
      (select count(*) from students) as players,
      (select count(*) from students where created_at > now() - interval '30 days') as players30,
      (select count(*) from exercises where is_global) as lib_exercises,
      (select count(*) from classes where is_library and status = 'published') as lib_classes,
      (select count(*) from tennis_objectives
        where is_active and club_id is null and coach_id is null and student_id is null) as lib_objectives
  `);

  const clubRows = await db.execute<Record<string, unknown>>(sql`
    select c.id, c.name, c.created_at,
      (select count(*) from club_members cm
        where cm.club_id = c.id and cm.status = 'active') as coaches,
      (select count(*) from students s where s.club_id = c.id) as players
    from clubs c
    order by c.created_at desc
  `);

  return {
    clubs: { total: n(counts?.clubs), last30: n(counts?.clubs30) },
    coaches: { total: n(counts?.coaches), last30: n(counts?.coaches30) },
    families: { total: n(counts?.families), last30: n(counts?.families30) },
    players: { total: n(counts?.players), last30: n(counts?.players30) },
    library: {
      exercises: n(counts?.lib_exercises),
      classes: n(counts?.lib_classes),
      objectives: n(counts?.lib_objectives),
    },
    clubRows: clubRows.map((r) => ({
      id: String(r.id),
      name: String(r.name),
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
      coaches: n(r.coaches),
      players: n(r.players),
    })),
  };
}
