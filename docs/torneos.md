# Torneos — decisiones y pendientes

Rama `feat/torneos`. Lógica pura en `lib/tournaments/`, capa de datos en `lib/tournaments/server.ts`, API de gestión en `app/api/tournaments/`. Tablas en la migración `0106_tournaments.sql`: **aplicada solo en pruebas** (`xiqppj…`, 2026-11-19); en producción la aplica David.

## Decisiones

- **Consentimiento de alumnos de la escuela (David, 2026-11-19):** de momento lo declara el monitor al añadirlos (`consent_method = coach_declared`, con su usuario, el nombre de quien da el permiso y la fecha). Más adelante se pedirá al tutor por enlace (`guardian_link`), como en Mensajes. Quien se inscribe por el enlace público lo da en el formulario (`form`). Versión del texto: `torneo-v1` (`lib/tournaments/consent.ts`).
- **Nombre en la página pública (David, 2026-11-19):** nombre e iniciales de los apellidos para todos, de la escuela o externos, también menores («Lucía García López» → «Lucía G. L.»). Nunca correo ni teléfono.
- **Origen de los jugadores:** alumnos de la escuela (`school`), jugador externo añadido a mano por el organizador (`manual`) o inscripción por el enlace público (`link`, fase 4).
- **Quién gestiona un torneo de club:** cualquier miembro activo del club en modo club, igual que alumnos y grupos (que ya se comparten así). En modo particular, solo el monitor.
- **Datos de contacto en torneos de club (David, 2026-11-19):** solo los ve el administrador del club (la cuenta dueña). El resto de monitores gestiona el torneo sin verlos (`lib/tournaments/privacy.ts`). En modo particular los ve el monitor. El token de cancelación no se devuelve nunca.
- **Estilo de las pantallas de torneos (David, 2026-11-19):** azul `#1a6db5` como color principal, títulos en Fraunces y texto en DM Sans, tarjetas con fondo de color sólido. Ojo: el resto de la app usa lima y Plus Jakarta Sans; DM Sans no está aún en `app/fonts`.
- Una inscripción sin consentimiento queda `pending` y ocupa plaza; no puede pasar a `confirmed` (lo impide también la base). Al generar el cuadro avisa si hay pendientes; se puede generar dejándolas fuera.
- Duplicados: los alumnos se distinguen por su ficha (dos hermanos pueden compartir correo); los externos, por correo o teléfono normalizados.
- Menor sin datos: su contacto es el del padre, madre o tutor (primero activo en «Familias» con correo o teléfono); nunca el del propio menor. Alumno sin fecha de nacimiento = menor (regla de `lib/age.ts`).
- Cierre de inscripciones: se calcula al leer (`effectiveStatus`), sin cron.
- Liguilla: como mucho 16 participantes (120 partidos). Walkover = victoria sin sets ni juegos.
- Tras generar el cuadro no se cancelan inscripciones (se usa walkover en el partido). No se borran torneos ni inscripciones desde la API.
- Slug con sufijo aleatorio criptográfico: la URL no se puede adivinar.

## Pendiente de decidir (David)

- Texto exacto del consentimiento `torneo-v1` (revisión legal).

## Pendiente de hacer

- Fase 3: asistente y selector de alumnos. Fase 4: página pública e inscripción por enlace (con correo). Fase 5: pantalla de resultados. Fase 6: revisión completa en móvil.
- Enlace de consentimiento para tutores (`guardian_link`).
- Correo de confirmación: en Vercel faltan `RESEND_API_KEY` y `EMAIL_FROM`.

## Pruebas

- `pnpm test`: lógica pura, validación y rutas (la capa de datos simulada).
- Integración contra la base de **pruebas** (crea y borra sus torneos):
  `TOURNAMENTS_DB_IT=1 node --env-file=../app/.env.local node_modules/vitest/vitest.mjs run tests/integration`
  Solo corre si `DATABASE_URL` es del proyecto de pruebas.
