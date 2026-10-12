import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Política de Cookies · TenPlanner",
  description: "Qué cookies usamos y para qué.",
};

function H2({ children, id }: { children: React.ReactNode; id: string }) {
  return (
    <h2
      id={id}
      className="font-heading text-2xl lg:text-3xl italic text-foreground mt-12 mb-4 scroll-mt-24"
    >
      {children}
    </h2>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] leading-relaxed text-foreground/80 my-3">
      {children}
    </p>
  );
}

export default function CookiesPage() {
  return (
    <article>
      <p className="font-sans text-[10px] uppercase tracking-[0.28em] text-brand mb-2">
        03 · Cookies
      </p>
      <h1 className="font-heading text-4xl lg:text-5xl text-foreground leading-[0.95] tracking-tight">
        Qué cookies usamos
      </h1>
      <p className="text-[14px] text-foreground/60 mt-4">
        Conforme al art. 22.2 de la LSSI-CE y a las directrices de la AEPD
        (2023).
      </p>

      <div className="mt-8 border-l-2 border-brand pl-4 py-1 text-[13px] text-foreground/70">
        TenPlanner <strong>no utiliza cookies de publicidad ni de tracking
        entre sitios</strong>. Solo empleamos cookies y almacenamiento local
        estrictamente necesarios para el funcionamiento del servicio, además
        de una analítica web agregada y sin cookies (Vercel Analytics) para
        saber cuánta gente visita la web.
      </div>

      <H2 id="que-son">1. Qué es una cookie</H2>
      <P>
        Una cookie es un pequeño archivo que se almacena en tu navegador cuando
        visitas un sitio web. Permite recordar información entre visitas (sesión
        iniciada, preferencias de interfaz, etc.).
      </P>

      <H2 id="tipos">2. Cookies y almacenamiento local en uso</H2>

      <div className="overflow-x-auto border border-foreground/15 rounded-md my-4">
        <table className="w-full text-[13px]">
          <thead className="bg-foreground/[0.03] border-b border-foreground/15">
            <tr>
              {["Nombre", "Tipo", "Finalidad", "Titular", "Duración"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/55 px-3 py-2.5"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {[
              [
                "sb-access-token / sb-refresh-token",
                "Cookie técnica esencial",
                "Mantener la sesión iniciada.",
                "Supabase (encargado).",
                "Sesión / 1 semana.",
              ],
              [
                "cookie-consent",
                "localStorage técnica",
                "Recordar que has visto el aviso informativo.",
                "TenPlanner.",
                "Persistente (hasta que borres tu almacenamiento).",
              ],
              [
                "theme",
                "localStorage técnica",
                "Recordar preferencia claro/oscuro.",
                "TenPlanner.",
                "Persistente.",
              ],
              [
                "accent",
                "localStorage técnica",
                "Recordar color de acento elegido.",
                "TenPlanner.",
                "Persistente.",
              ],
              [
                "font-size",
                "localStorage técnica",
                "Recordar tamaño de letra preferido.",
                "TenPlanner.",
                "Persistente.",
              ],
            ].map((row, i) => (
              <tr
                key={i}
                className="border-b border-foreground/10 last:border-0 align-top"
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2.5 text-foreground/80">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <P>
        Todas las entradas anteriores son <strong>técnicas</strong>, es decir,
        necesarias para prestar el servicio solicitado por el usuario. Por ello
        están exentas del deber de consentimiento previo (art. 22.2 LSSI-CE).
      </P>

      <H2 id="analitica">3. Analítica web</H2>
      <P>
        Usamos <strong>Vercel Analytics</strong> para saber cuántas personas
        visitan la web y qué páginas usan más. No instala ninguna cookie, no
        usa huellas digitales (fingerprinting) ni almacena tu dirección IP
        completa, y los datos se muestran siempre de forma agregada: no
        podemos identificarte a partir de ellos. Al no depender de cookies ni
        de tratamiento individualizado, no le aplica el deber de
        consentimiento previo del art. 22.2 LSSI-CE, pero te informamos aquí
        por transparencia.
      </P>
      <P>
        Proveedor: Vercel Inc. (EE. UU., amparado por Cláusulas Contractuales
        Tipo). Más detalle en la{" "}
        <a
          href="/privacidad#encargados"
          className="font-bold underline decoration-foreground/24 underline-offset-4 hover:text-foreground"
        >
          Política de Privacidad
        </a>
        .
      </P>

      <H2 id="control">4. Cómo desactivarlas</H2>
      <P>
        Puedes borrar o bloquear las cookies y el almacenamiento local desde los
        ajustes de tu navegador. Si las deshabilitas, es posible que no puedas
        iniciar sesión o que pierdas preferencias visuales.
      </P>

      <H2 id="futuro">5. Cambios futuros</H2>
      <P>
        Si en el futuro añadimos cookies de tracking entre sitios o
        publicidad, solicitaremos tu consentimiento previo mediante un banner
        granular y actualizaremos esta política.
      </P>
    </article>
  );
}
