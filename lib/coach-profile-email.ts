import type { EmailMessage } from "@/lib/email";
import { renderActionEmailHtml } from "@/lib/email-layout";

type CoachProfileEmailInput = {
  to: string;
  recipientName: string;
  clubName: string;
  profileUrl: string;
  expiryDays: number;
  /** Correo del gestor, para que el monitor pueda responderle. */
  replyTo?: string;
};

export function buildCoachProfileEmail(
  input: CoachProfileEmailInput
): EmailMessage {
  const greeting = input.recipientName
    ? `Hola, ${input.recipientName}`
    : "Hola";
  const subject = `${input.clubName} te pide tu ficha de monitor`;
  const intro = `${input.clubName} te pide que rellenes tu ficha de monitor: tus datos de contacto, formación, disponibilidad y experiencia.`;
  const detail =
    "Solo tarda unos minutos. Solo verá estos datos el club, y no necesitas crear ninguna cuenta.";
  const expiry = `El enlace es personal, se puede usar una sola vez y caduca en ${input.expiryDays} días. Si no lo esperabas, puedes ignorar este correo.`;

  const text = [
    greeting + ",",
    "",
    intro,
    detail,
    "",
    `Rellena tu ficha aquí: ${input.profileUrl}`,
    "",
    expiry,
  ].join("\n");

  const html = renderActionEmailHtml({
    greeting,
    paragraphs: [intro, detail],
    buttonLabel: "Rellenar mi ficha",
    buttonUrl: input.profileUrl,
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
