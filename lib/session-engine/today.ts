// "Hoy toca": próximo entreno del monitor y propuesta del motor para él.
// Lo usan la tarjeta del panel (al cargar) y POST /api/sessions/generate.

import { and, eq, gte, isNotNull, lt, ne } from "drizzle-orm";
import { db } from "@/db";
import { groups, sessions } from "@/db/schema";
import { sharedWithClubCondition } from "@/lib/clubs";
import {
  nextScheduleOccurrenceInZone,
  type GroupScheduleEntry,
} from "@/lib/groups/schedule";
import { generateSession } from "./index";
import { loadEngineData, loadEngineGroup, type EngineGroup } from "./repo-db";
import type {
  Duration,
  Focus,
  GenerateInput,
  Intensity,
  SessionPlan,
} from "./types";

export const ENGINE_TIME_ZONE = "Europe/Madrid";

export type NextTraining = {
  groupId: string;
  groupName: string;
  at: Date;
  /** Sesión ya creada para ese grupo ese día (no se propone otra). */
  existingSessionId: string | null;
};

/** Fecha local (YYYY-MM-DD) de un instante en la zona del motor. */
export function localDateKey(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ENGINE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}

/**
 * Próximo entreno entre los grupos del espacio activo y del deporte activo
 * que tienen horario. Una clase que empezó hace menos de una hora sigue
 * contando como "hoy toca".
 */
export async function findNextTraining(
  userId: string,
  activeClubId: string | null,
  sport: string,
  now = new Date()
): Promise<NextTraining | null> {
  const rows = await db
    .select({
      id: groups.id,
      name: groups.name,
      schedule: groups.weeklySchedule,
    })
    .from(groups)
    .where(
      and(
        sharedWithClubCondition(
          groups.coachId,
          groups.clubId,
          userId,
          activeClubId
        ),
        eq(groups.sport, sport as "tenis"),
        isNotNull(groups.weeklySchedule)
      )
    );
  let best: { id: string; name: string; at: Date } | null = null;
  for (const g of rows) {
    const at = nextScheduleOccurrenceInZone(
      g.schedule as GroupScheduleEntry[] | null,
      now,
      ENGINE_TIME_ZONE,
      60
    );
    if (at && (!best || at < best.at)) best = { id: g.id, name: g.name, at };
  }
  if (!best) return null;

  const from = new Date(best.at.getTime() - 12 * 3600_000);
  const to = new Date(best.at.getTime() + 12 * 3600_000);
  const [existing] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(
      and(
        eq(sessions.groupId, best.id),
        gte(sessions.scheduledAt, from),
        lt(sessions.scheduledAt, to),
        ne(sessions.status, "cancelled")
      )
    )
    .limit(1);
  return {
    groupId: best.id,
    groupName: best.name,
    at: best.at,
    existingSessionId: existing?.id ?? null,
  };
}

export type ProposalRequest = {
  groupId: string;
  date: string;
  durationMinutes: Duration;
  intensity: Intensity;
  focus: Focus;
  /** null = todos los alumnos del grupo. */
  attendeeIds: string[] | null;
  pinned?: GenerateInput["pinned"];
  previousIds?: string[];
  slotAdjust?: GenerateInput["slotAdjust"];
  /** Variante de "Otra propuesta" (0 = la primera). */
  variant?: number;
};

export type Proposal = {
  group: Pick<EngineGroup, "id" | "name" | "sport" | "defaultLevel"> & {
    students: { id: string; name: string }[];
  };
  input: GenerateInput;
  plan: SessionPlan;
};

export async function buildProposal(
  userId: string,
  activeClubId: string | null,
  req: ProposalRequest
): Promise<Proposal | null> {
  const group = await loadEngineGroup(userId, activeClubId, req.groupId);
  if (!group) return null;
  const memberIds = new Set(group.students.map((s) => s.id));
  const attendeeIds =
    req.attendeeIds === null
      ? [...memberIds]
      : req.attendeeIds.filter((id) => memberIds.has(id));
  const baseSeed = `${group.id}|${req.date}`;
  const input: GenerateInput = {
    groupId: group.id,
    durationMinutes: req.durationMinutes,
    intensity: req.intensity,
    focus: req.focus,
    attendeeIds,
    pinned: req.pinned,
    previousIds: req.previousIds,
    slotAdjust: req.slotAdjust,
    seed: req.variant ? `${baseSeed}#${req.variant}` : baseSeed,
  };
  const data = await loadEngineData(userId, group, attendeeIds);
  const plan = generateSession(input, data);
  return {
    group: {
      id: group.id,
      name: group.name,
      sport: group.sport,
      defaultLevel: group.defaultLevel,
      students: group.students.map((s) => ({ id: s.id, name: s.name })),
    },
    input,
    plan,
  };
}
