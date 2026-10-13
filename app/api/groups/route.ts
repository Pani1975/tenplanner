import { and, eq, count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { groups, groupStudents, students, users } from "@/db/schema";
import { createClient } from "@/lib/supabase/server";
import { getBooleanSetting } from "@/lib/app-settings";
import { getActiveWorkClubId, sharedWithClubCondition } from "@/lib/clubs";
import { getActiveSport } from "@/lib/sports";
import type { GroupScheduleEntry } from "@/lib/groups/schedule";

const createSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
});

export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groupsEnabled = await getBooleanSetting("feature.groups_enabled");
  if (!groupsEnabled) {
    return NextResponse.json(
      { error: "Los grupos de alumnos están desactivados." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const withStudents = searchParams.get("withStudents") === "true";

  const [activeClubId, activeSport] = await Promise.all([
    getActiveWorkClubId(user.id),
    getActiveSport(user.id),
  ]);
  const visibility = and(
    sharedWithClubCondition(groups.coachId, groups.clubId, user.id, activeClubId),
    eq(groups.sport, activeSport)
  )!;

  if (withStudents) {
    // Return groups with member IDs for wizard group-select
    const rows = await db
      .select({
        groupId: groups.id,
        groupName: groups.name,
        description: groups.description,
        studentId: students.id,
      })
      .from(groups)
      .leftJoin(groupStudents, eq(groupStudents.groupId, groups.id))
      .leftJoin(students, eq(groupStudents.studentId, students.id))
      .where(visibility)
      .orderBy(groups.name)
      .catch(
        () =>
          [] as {
            groupId: string;
            groupName: string;
            description: string | null;
            studentId: string | null;
          }[]
      );

    const map = new Map<
      string,
      {
        id: string;
        name: string;
        description: string | null;
        memberCount: number;
        studentIds: string[];
      }
    >();
    for (const row of rows) {
      if (!map.has(row.groupId)) {
        map.set(row.groupId, {
          id: row.groupId,
          name: row.groupName,
          description: row.description ?? null,
          memberCount: 0,
          studentIds: [],
        });
      }
      if (row.studentId) {
        const g = map.get(row.groupId)!;
        g.studentIds.push(row.studentId);
        g.memberCount++;
      }
    }
    return NextResponse.json({ data: Array.from(map.values()) });
  }

  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      description: groups.description,
      createdAt: groups.createdAt,
      memberCount: count(groupStudents.id),
      coachId: groups.coachId,
      authorName: users.name,
      weeklySchedule: groups.weeklySchedule,
    })
    .from(groups)
    .leftJoin(groupStudents, eq(groupStudents.groupId, groups.id))
    .leftJoin(users, eq(users.id, groups.coachId))
    .where(visibility)
    .groupBy(groups.id, users.name)
    .orderBy(groups.name)
    .catch(
      () =>
        [] as {
          id: string;
          name: string;
          description: string | null;
          createdAt: Date;
          memberCount: number;
          coachId: string;
          authorName: string | null;
          weeklySchedule: GroupScheduleEntry[] | null;
        }[]
    );

  return NextResponse.json({
    data: rows.map((r) => ({
      ...r,
      authorName: r.coachId !== user.id ? r.authorName : null,
    })),
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const groupsEnabled = await getBooleanSetting("feature.groups_enabled");
  if (!groupsEnabled) {
    return NextResponse.json(
      { error: "Los grupos de alumnos están desactivados." },
      { status: 403 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const [clubId, sport] = await Promise.all([
    getActiveWorkClubId(user.id),
    getActiveSport(user.id),
  ]);

  const [group] = await db
    .insert(groups)
    .values({
      coachId: user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      clubId,
      sport,
    })
    .returning();

  return NextResponse.json({ data: group }, { status: 201 });
}
