// Envío de correos transaccionales (invitaciones de club, etc.) con la API
// HTTP de Resend. Sin dependencias: si RESEND_API_KEY no está configurada,
// no se envía nada y quien llama recibe `sent: false` para avisar al usuario
// (el enlace de invitación sigue funcionando copiándolo a mano).

export type SendEmailResult =
  | { sent: true }
  | { sent: false; reason: "not_configured" | "provider_error" };

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

const DEFAULT_FROM = "TenPlanner <onboarding@resend.dev>";

export async function sendEmail(
  message: EmailMessage
): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return { sent: false, reason: "not_configured" };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || DEFAULT_FROM,
        to: [message.to],
        subject: message.subject,
        html: message.html,
        text: message.text,
        ...(message.replyTo ? { reply_to: message.replyTo } : {}),
      }),
    });
    if (!res.ok) {
      console.error("Email provider rejected the message", {
        status: res.status,
      });
      return { sent: false, reason: "provider_error" };
    }
    return { sent: true };
  } catch (error) {
    console.error("Email provider request failed", { error });
    return { sent: false, reason: "provider_error" };
  }
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** URL pública del sitio: la variable de entorno o, si falta, la de la petición. */
export function getSiteUrl(requestUrl: string) {
  return (
    process.env.NEXT_PUBLIC_SITE_URL || new URL(requestUrl).origin
  ).replace(/\/$/, "");
}
