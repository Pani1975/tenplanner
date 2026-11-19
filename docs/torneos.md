# Torneos — decisiones y pendientes

Rama `feat/torneos`. Lógica pura en `lib/tournaments/`, capa de datos en `lib/tournaments/server.ts`, API de gestión en `app/api/tournaments/`. Tablas en la migración `0106_tournaments.sql`: **aplicada solo en pruebas** (`xiqppj…`, 2026-11-19); en producción la aplica David.

## Decisiones

- **Consentimiento de alumnos de la escuela (David, 2026-11-19):** de momento lo declara el monitor al añadirlos (`consent_method = coach_declared`, con su usuario, el nombre de quien da el permiso y la fecha). Más adelante se pedirá al tutor por enlace (`guardian_link`), como en Mensajes. Quien se inscribe por el enlace público lo da en el formulario (`form`). Versión del texto: `torneo-v1` (`lib/tournaments/consent.ts`).
- **Nombre en la página pública (David, 2026-11-19):** nombre e iniciales de los apellidos para todos, de la escuela o externos, también menores («Lucía García López» → «Lucía G. L.»). Nunca correo ni teléfono.
- **Origen de los jugadores:** alumnos de la escuela (`school`), jugador externo añadido a mano por el organizador (`manual`) o inscripción por el enlace público (`link`, fase 4).
- **Quién gestiona un torneo de club:** cualquier miembro activo del club en modo club, igual que alumnos y grupos (que ya se comparten así). En modo particular, solo el monitor.
- **Datos de contacto en torneos de club (David, 2026-11-19):** solo los ve el administrador del club (la cuenta dueña). El resto de monitores gestiona el torneo sin verlos (`lib/tournaments/privacy.ts`). En modo particular los ve el monitor. El token de cancelación no se devuelve nunca.
- **Estilo de las pantallas de torneos (David, 2026-11-19):** azul `#1a6db5` como color principal, títulos en Fraunces y texto en DM Sans, tarjetas con fondo de color sólido. Solo dentro de `.tp-torneos` (`app/(app)/torneos/layout.tsx`); el resto de la app sigue en lima y Plus Jakarta Sans. DM Sans en `app/fonts` (OFL, de `@fontsource-variable/dm-sans`).
- **Circuito (David, 2026-11-19):** cada torneo es independiente o pertenece a un circuito (`tournament_circuits`: nombre y temporada, del club o del monitor). Se elige en el paso 1 del asistente; un circuito nuevo con el mismo nombre y temporada reutiliza el existente.
- **Nivel:** la escala de la app (`skill_levels`) mostrada con su bola en tenis: «Bola roja · Descubrimiento», «Bola naranja · Desarrollo», «Bola verde · Consolidación» y las cuatro etapas de bola amarilla.
- **Página pública `/t/<slug>` (David, 2026-11-19):** muestra el número de inscritos contando la lista de espera, la lista de inscritos y de espera (nombre e iniciales), el formulario de inscripción mientras esté abierto y, cuando hay partidos, el cuadro o la clasificación. Borrador = 404. No se indexa (`noindex`): hay menores.
- **Inscripción por enlace:** consentimiento RGPD obligatorio, trampa para robots y límite de 8 envíos por IP cada 10 min. Duplicado = mismo correo o teléfono propio (los menores van con el contacto del tutor y no cuentan, para que dos hermanos puedan apuntarse). Correo de confirmación con enlace para cancelar (`/t/<slug>/cancelar?token=…`); al cancelar entra el primero de la lista y, si se inscribió por enlace, recibe un correo.
- **Circuito con puntos (David, 2026-11-19):** puntos por torneo finalizado según la ronda alcanzada (eliminatoria) o el puesto (liguilla) y clasificación general pública en `/t/c/<slug>`. Mismo jugador en distintos torneos: por su ficha de alumno, si no por correo, teléfono o nombre completo. En dobles puntúa cada jugador. Desempate: mejor resultado y luego más torneos.
- Una inscripción sin consentimiento queda `pending` y ocupa plaza; no puede pasar a `confirmed` (lo impide también la base). Al generar el cuadro avisa si hay pendientes; se puede generar dejándolas fuera.
- Duplicados: los alumnos se distinguen por su ficha (dos hermanos pueden compartir correo); los externos, por correo o teléfono normalizados.
- Menor sin datos: su contacto es el del padre, madre o tutor (primero activo en «Familias» con correo o teléfono); nunca el del propio menor. Alumno sin fecha de nacimiento = menor (regla de `lib/age.ts`).
- Cierre de inscripciones: se calcula al leer (`effectiveStatus`), sin cron.
- Liguilla: como mucho 16 participantes (120 partidos). Walkover = victoria sin sets ni juegos.
- Tras generar el cuadro no se cancelan inscripciones (se usa walkover en el partido). No se borran torneos ni inscripciones desde la API.
- Slug con sufijo aleatorio criptográfico: la URL no se puede adivinar.

## Pendiente de decidir (David)

- Texto exacto del consentimiento `torneo-v1` (revisión legal).
- Texto de consentimiento del formulario público y quién figura como responsable del tratamiento (el club o monitor organizador). Revisión legal antes de abrir torneos reales.
- Tabla de puntos del circuito: hoy la de por defecto (campeón 100, finalista 70, semis 50, cuartos 35, octavos 20, antes 10; liguilla 100-70-50-40-30-25-20-15-10; mínimo 5). Se guarda por circuito (`points`), pero aún no hay pantalla para cambiarla.

## Pendiente de hacer

- Hechas las fases 1 a 4. Falta en la ficha: editar los datos del torneo y fijar cabezas de serie (la API ya lo admite). Fase 5: generar el cuadro y meter resultados desde la ficha. Fase 6: revisión completa en móvil.
- Enlace de consentimiento para tutores (`guardian_link`).
- Correo de confirmación: en Vercel faltan `RESEND_API_KEY` y `EMAIL_FROM`.

## Pruebas

- `pnpm test`: lógica pura, validación y rutas (la capa de datos simulada).
- Integración contra la base de **pruebas** (crea y borra sus torneos):
  `TOURNAMENTS_DB_IT=1 node --env-file=../app/.env.local node_modules/vitest/vitest.mjs run tests/integration`
  Solo corre si `DATABASE_URL` es del proyecto de pruebas.
