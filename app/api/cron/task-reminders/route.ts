import { and, eq, inArray, isNotNull, isNull, lte } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { clubs, managementTasks, users } from "@/db/schema";
import { getSiteUrl, sendEmail } from "@/lib/email";
import { responsibleLabel } from "@/lib/management-tasks";
import {
  buildReminderEmail,
  todayInMadrid,
  type ReminderTask,
} from "@/lib/task-reminders";

// Aviso diario por correo de las tareas de gestión con "avisarme" marcado, el
// día de su fecha (o después, si no se pudo enviar antes). Un correo por club,
// al correo de la cuenta del club. Solo se marca como avisada la tarea cuyo
// correo se envió; si el servicio de correo no está configurado, se reintenta
// al día siguiente.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 500 }
    );
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = todayInMadrid();
  const rows = await db
    .select({
      task: managementTasks,
      clubName: clubs.name,
      ownerEmail: users.email,
    })
    .from(managementTasks)
    .innerJoin(clubs, eq(clubs.id, managementTasks.clubId))
    .innerJoin(users, eq(users.id, clubs.ownerId))
    .where(
      and(
        eq(managementTasks.notifyEmail, true),
        isNull(managementTasks.notifiedAt),
        isNull(managementTasks.doneAt),
        isNotNull(managementTasks.dueDate),
        lte(managementTasks.dueDate, today)
      )
    );

  // Nombre del monitor responsable, si lo hay.
  const coachIds = [
    ...new Set(
      rows
        .map((r) => r.task.responsibleUserId)
        .filter((id): id is string => !!id)
    ),
  ];
  const coachNames = new Map<string, string>();
  if (coachIds.length > 0) {
    const coaches = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(inArray(users.id, coachIds));
    for (const c of coaches) coachNames.set(c.id, c.name);
  }

  const byClub = new Map<
    string,
    { clubName: string; to: string; tasks: ReminderTask[]; ids: string[] }
  >();
  for (const r of rows) {
    const entry = byClub.get(r.task.clubId) ?? {
      clubName: r.clubName,
      to: r.ownerEmail,
      tasks: [],
      ids: [],
    };
    entry.tasks.push({
      id: r.task.id,
      title: r.task.title,
      description: r.task.description,
      dueDate: r.task.dueDate!,
      responsible: responsibleLabel(
        r.task,
        r.task.responsibleUserId
          ? (coachNames.get(r.task.responsibleUserId) ?? null)
          : null,
        r.clubName
      ),
    });
    entry.ids.push(r.task.id);
    byClub.set(r.task.clubId, entry);
  }

  const panelUrl = `${getSiteUrl(request.url)}/calendar`;
  let sent = 0;
  let failed = 0;
  let notConfigured = 0;
  for (const entry of byClub.values()) {
    const result = await sendEmail(
      buildReminderEmail(entry.to, entry.clubName, entry.tasks, panelUrl, today)
    );
    if (result.sent) {
      await db
        .update(managementTasks)
        .set({ notifiedAt: new Date() })
        .where(inArray(managementTasks.id, entry.ids));
      sent += 1;
    } else if (result.reason === "not_configured") {
      notConfigured += 1;
    } else {
      failed += 1;
    }
  }

  const summary = {
    ranAt: new Date().toISOString(),
    today,
    clubsToNotify: byClub.size,
    emailsSent: sent,
    emailsFailed: failed,
    emailNotConfigured: notConfigured,
  };
  console.info("[cron/task-reminders]", JSON.stringify(summary));
  return NextResponse.json(summary, {
    headers: { "Cache-Control": "no-store" },
  });
}
