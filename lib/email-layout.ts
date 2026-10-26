import { escapeHtml } from "@/lib/email";

// Plantilla común de los correos con un botón de acción (invitaciones de
// club, enlaces de ficha...). Todo el texto se escapa aquí.

export type ActionEmailContent = {
  greeting: string;
  paragraphs: string[];
  buttonLabel: string;
  buttonUrl: string;
  footnote: string;
};

export function renderActionEmailHtml(c: ActionEmailContent) {
  const paragraphs = c.paragraphs
    .map(
      (text, i) =>
        `<p style="margin:0 0 ${i === c.paragraphs.length - 1 ? 28 : 12}px;font-size:15px;line-height:1.6;${i === 0 ? "" : "color:#444444;"}">${escapeHtml(text)}</p>`
    )
    .join("\n                ");
  return `<!doctype html>
<html lang="es">
  <body style="margin:0;padding:0;background:#f6f5f2;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111111;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f6f5f2;">
      <tr>
        <td align="center" style="padding:48px 20px;">
          <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:560px;max-width:100%;background:#ffffff;border:1px solid #e6e4df;">
            <tr>
              <td style="padding:32px 40px;">
                <p style="margin:0 0 24px;font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#1a6db5;">TenPlanner</p>
                <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;">${escapeHtml(c.greeting)}</h1>
                ${paragraphs}
                <a href="${escapeHtml(c.buttonUrl)}" style="display:inline-block;background:#1a6db5;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:999px;">${escapeHtml(c.buttonLabel)}</a>
                <p style="margin:28px 0 0;font-size:13px;line-height:1.6;color:#666666;">${escapeHtml(c.footnote)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
