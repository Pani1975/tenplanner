import type { EmailMessage } from "@/lib/email";
import { renderActionEmailHtml } from "@/lib/email-layout";

type ClubInviteEmailInput = {
  to: string;
  inviteeName: string | null;
  clubName: string;
  sportLabel: string;
  inviteUrl: string;
  expiryDays: number;
  /** Correo del director, para que el monitor pueda responderle. */
  replyTo?: string;
};

export function buildClubInviteEmail(
  input: ClubInviteEmailInput
): EmailMessage {
  const greeting = input.inviteeName ? `Hola, ${input.inviteeName}` : "Hola";
  const subject = `${input.clubName} te invita a TenPlanner`;
  const intro = `${input.clubName} te ha invitado a unirte como monitor de ${input.sportLabel} en TenPlanner.`;
  const accept =
    "Al aceptar, el club tendrá acceso compartido a tus sesiones, alumnos, grupos y calendario de ese deporte. Tu cuenta sigue siendo tuya.";
  const expiry = `La invitación caduca en ${input.expiryDays} días. Si no la esperabas, puedes ignorar este correo.`;

  const text = [
    greeting + ",",
    "",
    intro,
    accept,
    "",
    `Abre este enlace para verla y aceptarla: ${input.inviteUrl}`,
    "",
    expiry,
  ].join("\n");

  const html = renderActionEmailHtml({
    greeting,
    paragraphs: [intro, accept],
    buttonLabel: "Ver invitación",
    buttonUrl: input.inviteUrl,
    footnote: expiry,
  });

  return {
    to: input.to,
    subject,
    html,
    text,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  };
}
