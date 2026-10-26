import { escapeHtml, type EmailMessage } from "@/lib/email";

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

  const html = `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f6f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111111;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f5f2;">
      <tr>
        <td align="center" style="padding:48px 20px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:#ffffff;border:1px solid #e6e4df;">
            <tr>
              <td style="padding:32px 40px;">
                <p style="margin:0 0 24px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1a6db5;">TenPlanner</p>
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(greeting)}</h1>
                <p style="margin:0 0 12px;font-size:15px;line-height:1.6;">${escapeHtml(intro)}</p>
                <p style="margin:0 0 28px;font-size:15px;line-height:1.6;color:#444444;">${escapeHtml(accept)}</p>
                <a href="${escapeHtml(input.inviteUrl)}" style="display:inline-block;background:#1a6db5;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;">Ver invitación</a>
                <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#666666;">${escapeHtml(expiry)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  return {
    to: input.to,
    subject,
    html,
    text,
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  };
}
