import type { Metadata } from "next";
import { legal } from "@/lib/legal-config";

export const metadata: Metadata = {
  title: "Política de Privacidad · TenPlanner",
  description:
    "Cómo TenPlanner recoge, usa y protege los datos personales de entrenadores y alumnos según el RGPD y la LOPDGDD.",
};

const UPDATED = "23 de abril de 2026";
const VERSION = "1.0";

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

function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-sans text-[11px] uppercase tracking-[0.22em] text-foreground/60 mt-6 mb-3">
      {children}
    </h3>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[14px] leading-relaxed text-foreground/80 my-3">
      {children}
    </p>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto border border-foreground/15 rounded-md my-4">
      <table className="w-full text-[13px]">
        <thead className="bg-foreground/[0.03] border-b border-foreground/15">
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                className="text-left font-sans text-[10px] uppercase tracking-[0.18em] text-foreground/55 px-3 py-2.5"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
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
  );
}

export default function PrivacidadPage() {
  return (
    <article>
      <p className="font-sans text-[10px] uppercase tracking-[0.28em] text-brand mb-2">
        01 · Política de privacidad
      </p>
      <h1 className="font-heading text-4xl lg:text-5xl text-foreground leading-[0.95] tracking-tight">
        Cómo tratamos tus datos
      </h1>
      <p className="text-[14px] text-foreground/60 mt-4">
        Versión {VERSION} · Última actualización: {UPDATED}
      </p>

      <div className="mt-8 border-l-2 border-brand pl-4 py-1 text-[13px] text-foreground/70">
        Este documento explica qué datos personales recogemos, para qué los
        usamos, con quién los compartimos y qué derechos tienes, de acuerdo con
        el Reglamento (UE) 2016/679 (<strong>RGPD</strong>) y la Ley Orgánica
        3/2018 (<strong>LOPDGDD</strong>).
      </div>

      <H2 id="responsable">1. Responsable del tratamiento</H2>
      <P>El responsable del tratamiento de tus datos personales es:</P>
      <div className="border border-foreground/15 rounded-md px-4 py-3 my-4 text-[13px] text-foreground/80 space-y-1">
        <p>
          <strong>Titular:</strong> {legal.companyName}
        </p>
        <p>
          <strong>NIF / CIF:</strong> {legal.nif}
        </p>
        <p>
          <strong>Domicilio:</strong> {legal.address}
        </p>
        <p>
          <strong>Correo de contacto:</strong>{" "}
          <a
            href={`mailto:${legal.privacyEmail}`}
            className="underline underline-offset-4 decoration-foreground/30 hover:text-foreground"
          >
            {legal.privacyEmail}
          </a>
        </p>
        {legal.dpo && (
          <p>
            <strong>Delegado de Protección de Datos (DPO):</strong> {legal.dpo}
          </p>
        )}
      </div>

      <H2 id="datos">2. Datos que tratamos</H2>

      <H3>2.1. Datos del entrenador (usuario registrado)</H3>
      <Table
        headers={["Categoría", "Datos concretos", "Origen"]}
        rows={[
          [
            "Identificación",
            "Nombre, correo electrónico, imagen de perfil.",
            "Registro en la plataforma.",
          ],
          [
            "Perfil profesional",
            "Rol (entrenador/jugador), nivel, años de experiencia, ciudad, preferencia de superficie, objetivos, biografía.",
            "Entrada manual.",
          ],
          [
            "Contenido generado",
            "Sesiones creadas, ejercicios de biblioteca propia, conversaciones con Dr. Planner.",
            "Uso de la plataforma.",
          ],
          [
            "Técnicos",
            "Dirección IP, logs de acceso, identificadores de sesión (Supabase Auth).",
            "Generados automáticamente.",
          ],
          [
            "Analítica web agregada",
            "Páginas visitadas, país aproximado y tipo de dispositivo, sin cookies ni IP completa (Vercel Analytics). No se asocia a tu cuenta.",
            "Generados automáticamente al navegar por la web.",
          ],
        ]}
      />

      <H3>2.2. Datos del alumno (tercero invitado por el entrenador)</H3>
      <Table
        headers={["Categoría", "Datos concretos", "Origen"]}
        rows={[
          [
            "Identificación",
            "Nombre, correo electrónico (opcional).",
            "El entrenador al crear la ficha.",
          ],
          [
            "Perfil físico",
            "Género, fecha de nacimiento, altura, peso, mano dominante.",
            "El alumno al completar el formulario público /s/[token].",
          ],
          [
            "Perfil deportivo",
            "Nivel de juego, años de experiencia, foto.",
            "Entrenador y/o alumno.",
          ],
          [
            "Registro de consentimiento",
            "Marca temporal y versión del aviso aceptado.",
            "Automático al marcar el checkbox.",
          ],
          [
            "Histórico de sesiones",
            "Asistencia, valoraciones, notas del entrenador.",
            "Uso de la plataforma por el entrenador.",
          ],
        ]}
      />

      <P>
        <strong>Nota sobre datos de salud.</strong> Altura, peso y observaciones
        libres del entrenador pueden constituir categorías especiales de datos
        (art. 9 RGPD) si permiten inferir información sobre el estado físico.
        Solo se tratan con consentimiento explícito del alumno (art. 9.2.a RGPD)
        y exclusivamente para la finalidad deportiva.
      </P>

      <H2 id="finalidades">3. Finalidades y bases jurídicas</H2>
      <Table
        headers={["Finalidad", "Base jurídica", "Dato afectado"]}
        rows={[
          [
            "Prestar el servicio de planificación al entrenador.",
            "Ejecución de contrato (art. 6.1.b RGPD).",
            "Datos del entrenador.",
          ],
          [
            "Permitir al entrenador gestionar fichas de sus alumnos.",
            "Interés legítimo del entrenador como responsable sobre los datos del alumno (art. 6.1.f). TenPlanner actúa como encargado (art. 28 RGPD).",
            "Datos del alumno.",
          ],
          [
            "Recoger el perfil físico del alumno vía enlace /s/[token].",
            "Consentimiento explícito del alumno (art. 6.1.a y art. 9.2.a).",
            "Altura, peso, fecha de nacimiento, género, mano dominante.",
          ],
          [
            "Procesar consultas en el asistente Dr. Planner (IA).",
            "Ejecución de contrato con el entrenador.",
            "Contenido escrito en el chat.",
          ],
          [
            "Seguridad, prevención de fraude, logs técnicos.",
            "Interés legítimo (art. 6.1.f).",
            "IP, logs de autenticación.",
          ],
          [
            "Medir el uso de la web de forma agregada y mejorar el servicio.",
            "Interés legítimo (art. 6.1.f). Al no usar cookies ni identificar a la persona, no requiere consentimiento (art. 22.2 LSSI-CE).",
            "Páginas vistas, país aproximado, dispositivo (Vercel Analytics).",
          ],
        ]}
      />

      <H2 id="menores">4. Menores de edad</H2>
      <P>
        La edad mínima para consentir el tratamiento de datos en España es{" "}
        <strong>14 años</strong> (art. 7 LOPDGDD y art. 8 RGPD). El formulario
        público del alumno bloquea cualquier fecha de nacimiento que corresponda
        a una edad inferior a 14 años.
      </P>
      <P>
        Si un entrenador introduce manualmente datos de una persona menor de 14
        años debe contar con el consentimiento previo de quienes ejerzan la
        patria potestad o tutela, y es responsable de acreditarlo.
      </P>

      <H2 id="encargados">5. Encargados del tratamiento y destinatarios</H2>
      <P>
        Para prestar el servicio contratamos a los siguientes proveedores, que
        acceden a datos personales exclusivamente siguiendo nuestras
        instrucciones documentadas (art. 28 RGPD):
      </P>
      <Table
        headers={["Proveedor", "Servicio", "Ubicación", "Garantías"]}
        rows={[
          [
            "Supabase Inc.",
            "Base de datos, autenticación, almacenamiento de archivos.",
            "Región UE / infraestructura en EE. UU.",
            "DPA firmado + Cláusulas Contractuales Tipo (SCC) UE 2021/914.",
          ],
          [
            "Anthropic, PBC",
            "Modelo de lenguaje Claude para el asistente Dr. Planner.",
            "EE. UU.",
            "DPA + SCC + Zero Data Retention solicitado (sin retención por el proveedor).",
          ],
          [
            "Vercel Inc.",
            "Hosting y entrega de la aplicación web, y analítica web agregada sin cookies (Vercel Analytics).",
            "EE. UU. (red global CDN).",
            "DPA + SCC.",
          ],
          [
            "Pexels GmbH",
            "API pública de imágenes de stock.",
            "Alemania (UE).",
            "No recibe datos personales: solo consultas de búsqueda.",
          ],
          [
            "OpenStreetMap Foundation",
            "Geocodificación de la localidad (Nominatim) y mapas (OpenStreetMap) en las estadísticas de alumnos.",
            "Reino Unido.",
            "No recibe datos de alumnos: solo el nombre de la localidad y, al ver el mapa, la IP del navegador.",
          ],
        ]}
      />

      <P>
        No cedemos tus datos a terceros con fines comerciales. Solo los
        comunicamos a autoridades competentes cuando exista obligación legal.
      </P>

      <H2 id="transferencias">6. Transferencias internacionales</H2>
      <P>
        Anthropic y Vercel tratan datos en Estados Unidos. La transferencia está
        amparada por las Cláusulas Contractuales Tipo aprobadas por la Comisión
        Europea (Decisión de Ejecución 2021/914), firmadas en los contratos
        (DPA) con cada proveedor. Puedes solicitarnos una copia de las garantías
        en el correo de contacto.
      </P>

      <H2 id="conservacion">7. Plazos de conservación</H2>
      <Table
        headers={["Dato", "Plazo"]}
        rows={[
          [
            "Cuenta de entrenador activa.",
            "Mientras no se solicite la supresión.",
          ],
          [
            "Sesiones, ejercicios, alumnos.",
            "Mientras la cuenta del entrenador esté activa.",
          ],
          [
            "Conversaciones con Dr. Planner.",
            "180 días desde la última actividad del chat; luego se eliminan automáticamente.",
          ],
          [
            "Enlaces /s/[token].",
            "7 días desde la generación; luego se invalidan.",
          ],
          [
            "Logs de acceso y seguridad.",
            "12 meses (proveedor de infraestructura).",
          ],
          [
            "Datos tras supresión de cuenta.",
            "Se eliminan en ≤ 30 días de los sistemas activos; copias de seguridad cifradas se purgan en el ciclo habitual (≤ 90 días).",
          ],
        ]}
      />

      <H2 id="derechos">8. Tus derechos</H2>
      <P>
        En cualquier momento puedes ejercer los siguientes derechos sobre tus
        datos:
      </P>
      <ul className="list-disc pl-5 space-y-1.5 text-[14px] text-foreground/80 my-3">
        <li>
          <strong>Acceso:</strong> obtener una copia de los datos que tratamos.
        </li>
        <li>
          <strong>Rectificación:</strong> corregir datos inexactos.
        </li>
        <li>
          <strong>Supresión:</strong> eliminar tu cuenta y todos tus datos.
        </li>
        <li>
          <strong>Portabilidad:</strong> descargar tus datos en formato JSON
          (desde Perfil → Datos).
        </li>
        <li>
          <strong>Oposición y limitación:</strong> oponerte a tratamientos
          basados en interés legítimo o limitarlos.
        </li>
        <li>
          <strong>Retirada del consentimiento:</strong> cuando la base sea el
          consentimiento, sin efecto retroactivo.
        </li>
      </ul>
      <P>
        Para ejercerlos, escribe a{" "}
        <a
          href={`mailto:${legal.privacyEmail}`}
          className="underline underline-offset-4 decoration-foreground/30 hover:text-foreground"
        >
          {legal.privacyEmail}
        </a>{" "}
        acreditando tu identidad. Responderemos en un plazo máximo de 30 días.
      </P>
      <P>
        Si consideras que no hemos atendido correctamente tu solicitud, puedes
        presentar una reclamación ante la{" "}
        <a
          href="https://www.aepd.es"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 decoration-foreground/30 hover:text-foreground"
        >
          Agencia Española de Protección de Datos (AEPD)
        </a>
        .
      </P>

      <H2 id="seguridad">9. Medidas de seguridad</H2>
      <ul className="list-disc pl-5 space-y-1.5 text-[14px] text-foreground/80 my-3">
        <li>
          Cifrado TLS en tránsito y cifrado en reposo en la base de datos.
        </li>
        <li>
          Row Level Security (RLS) de PostgreSQL: cada entrenador solo accede a
          sus propios registros.
        </li>
        <li>Tokens de alumno firmados y con expiración de 7 días.</li>
        <li>Autenticación gestionada por Supabase Auth (JWT + OAuth).</li>
        <li>
          Control de acceso por rol y registro de auditoría en logs del
          proveedor.
        </li>
      </ul>

      <H2 id="brechas">10. Notificación de brechas</H2>
      <P>
        En caso de brecha de seguridad que suponga un riesgo para tus derechos y
        libertades, la notificaremos a la AEPD en un plazo máximo de 72 horas
        (art. 33 RGPD) y, cuando el riesgo sea alto, también a las personas
        afectadas (art. 34).
      </P>

      <H2 id="cambios">11. Cambios en esta política</H2>
      <P>
        Podemos actualizar esta política para reflejar cambios legales o
        técnicos. Publicaremos la versión vigente en esta página con la fecha de
        actualización. Los cambios sustanciales se comunicarán por correo a los
        usuarios registrados.
      </P>
    </article>
  );
}
