import { escapeHtml, type EmailMessage } from "@/lib/email";

/** Tarea que toca avisar, con lo necesario para el correo. */
export interface ReminderTask {
  id: string;
  title: string;
  description: string | null;
  /** AAAA-MM-DD */
  dueDate: string;
  responsible: string;
}

/** Fecha de hoy (AAAA-MM-DD) en España, que es la que cuenta para el aviso. */
export function todayInMadrid(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${date}T00:00:00Z`));
}

/**
 * Correo de aviso con las tareas del día (y las atrasadas) de un club. Un solo
 * correo por club, aunque haya varias tareas.
 */
export function buildReminderEmail(
  to: string,
  clubName: string,
  tasks: ReminderTask[],
  panelUrl: string,
  today: string
): EmailMessage {
  const sorted = [...tasks].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const subject =
    sorted.length === 1
      ? `Tarea de gestión: ${sorted[0].title}`
      : `${sorted.length} tareas de gestión para hoy`;

  const label = (t: ReminderTask) =>
    t.dueDate < today
      ? `venció el ${formatDate(t.dueDate)}`
      : `vence hoy, ${formatDate(t.dueDate)}`;

  const text = [
    `Tareas de gestión de ${clubName}:`,
    "",
    ...sorted.map(
      (t) =>
        `- ${t.title} (${label(t)}) · Responsable: ${t.responsible}` +
        (t.description ? `\n  ${t.description}` : "")
    ),
    "",
    `Ábrelas en tu panel: ${panelUrl}`,
  ].join("\n");

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111">
<p>Tareas de gestión de <strong>${escapeHtml(clubName)}</strong>:</p>
<ul style="padding-left:18px">
${sorted
  .map(
    (t) =>
      `<li style="margin-bottom:10px"><strong>${escapeHtml(t.title)}</strong><br>` +
      `<span style="color:#555">${escapeHtml(label(t))} · Responsable: ${escapeHtml(t.responsible)}</span>` +
      (t.description
        ? `<br><span>${escapeHtml(t.description)}</span>`
        : "") +
      `</li>`
  )
  .join("\n")}
</ul>
<p><a href="${escapeHtml(panelUrl)}">Abrir el calendario de gestión</a></p>
</div>`;

  return { to, subject, html, text };
}
