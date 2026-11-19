// Correos de torneos (Resend, vía lib/email.ts). Si RESEND_API_KEY no está
// configurada no se envía nada; la inscripción queda hecha igualmente.

import { renderActionEmailHtml } from "@/lib/email-layout";

type Base = {
  tournamentName: string;
  playerName: string;
  publicUrl: string;
  cancelUrl: string;
};

export function registrationEmail(
  c: Base & { status: string; waitlistPosition: number | null }
) {
  const waiting = c.status === "waitlist";
  const subject = waiting
    ? `Lista de espera · ${c.tournamentName}`
    : `Inscripción confirmada · ${c.tournamentName}`;
  const paragraphs = waiting
    ? [
        `${c.playerName} está en la lista de espera del torneo «${c.tournamentName}»${
          c.waitlistPosition ? ` (puesto ${c.waitlistPosition})` : ""
        }.`,
        "Si alguien cancela, entrarás por orden de llegada y te avisaremos por correo.",
      ]
    : [
        `La inscripción de ${c.playerName} en el torneo «${c.tournamentName}» está confirmada.`,
        "En la página del torneo verás los inscritos y, cuando empiece, el cuadro y los resultados.",
      ];
  return build(
    c,
    subject,
    waiting ? "Hola" : "¡Inscripción hecha!",
    paragraphs
  );
}

export function promotedEmail(c: Base) {
  return build(c, `Tienes plaza · ${c.tournamentName}`, "¡Tienes plaza!", [
    `Se ha liberado una plaza y ${c.playerName} pasa de la lista de espera a inscrito en «${c.tournamentName}».`,
    "Si ya no puedes jugar, cancela la inscripción para dejar el sitio a otra persona.",
  ]);
}

function build(
  c: Base,
  subject: string,
  greeting: string,
  paragraphs: string[]
) {
  const footnote = `¿No puedes jugar? Cancela la inscripción aquí: ${c.cancelUrl}`;
  const html = renderActionEmailHtml({
    greeting,
    paragraphs,
    buttonLabel: "Ver el torneo",
    buttonUrl: c.publicUrl,
    footnote,
  });
  const text = [
    greeting,
    "",
    ...paragraphs,
    "",
    `Torneo: ${c.publicUrl}`,
    footnote,
  ].join("\n");
  return { subject, html, text };
}
