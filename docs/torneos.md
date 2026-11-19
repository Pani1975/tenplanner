# Torneos — decisiones y pendientes

Rama `feat/torneos`. Lógica pura en `lib/tournaments/`, tablas en la migración `0106_tournaments.sql` (sin aplicar en ninguna base; la aplica David).

## Decisiones

- **Consentimiento de alumnos de la escuela (David, 2026-11-19):** de momento lo declara el monitor al añadirlos (`consent_method = coach_declared`, con su usuario, el nombre de quien da el permiso y la fecha). Más adelante se pedirá al tutor por enlace (`guardian_link`), como en Mensajes. Quien se inscribe por el enlace público lo da en el formulario (`form`). Versión del texto: `torneo-v1` (`lib/tournaments/consent.ts`).
- Una inscripción sin consentimiento queda `pending` y ocupa plaza; no puede pasar a `confirmed` (lo impide también la base).
- Cierre de inscripciones: se calcula al leer (`effectiveStatus`), sin cron.
- Página pública: nombre e inicial del primer apellido; nunca correo ni teléfono.
- Alumno sin fecha de nacimiento = menor (regla de `lib/age.ts`): contacto de padres o tutores.
- Walkover en liguilla: victoria sin sets ni juegos.
- Slug con sufijo aleatorio criptográfico: la URL no se puede adivinar.

## Pendiente de decidir (David)

- Menores en la página pública: hoy solo iniciales («L. G.»). ¿Mostrar nombre si el tutor lo autoriza?
- Estilo: lima actual de la app o azul `#1a6db5` con DM Sans.
- Texto exacto del consentimiento `torneo-v1` (revisión legal).

## Pendiente de hacer

- Fase 2: API de gestión. Fase 3: asistente y selector de alumnos. Fase 4: página pública e inscripción. Fase 5: resultados. Fase 6: revisión completa en móvil.
- Enlace de consentimiento para tutores (`guardian_link`).
- Correo de confirmación: en Vercel faltan `RESEND_API_KEY` y `EMAIL_FROM`.
