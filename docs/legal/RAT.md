# Registro de Actividades de Tratamiento (RAT)

Documento exigido por el art. 30 RGPD. Este RAT es interno; debe poder entregarse a la AEPD si lo solicita.

**Responsable del tratamiento:** `<!-- TODO: titular + NIF + domicilio + email -->`

**DPO:** `<!-- TODO: solo si se designa -->`

**Fecha última revisión:** 2026-04-23

---

## Actividad 1 — Gestión de cuenta de entrenador

| Campo                          | Valor                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| Finalidad                      | Prestar el servicio SaaS de planificación de entrenamientos al entrenador registrado.                                     |
| Base jurídica                  | Art. 6.1.b RGPD — ejecución de contrato.                                                                                  |
| Categorías de interesados      | Entrenadores de pádel registrados.                                                                                        |
| Categorías de datos            | Identificativos (nombre, email, imagen), perfil profesional (rol, nivel, experiencia, ciudad), datos técnicos (IP, logs). |
| Destinatarios                  | Supabase (hosting BBDD y auth), Vercel (hosting aplicación).                                                              |
| Transferencias internacionales | EE. UU. vía SCC (cubiertas por DPA de proveedores).                                                                       |
| Plazo de supresión             | Mientras la cuenta esté activa. Tras baja: ≤ 30 días en sistemas activos, ≤ 90 días en backups.                           |
| Medidas técnicas               | TLS, cifrado en reposo, RLS, MFA disponible en Supabase Auth.                                                             |

## Actividad 2 — Gestión de alumnos del entrenador

| Campo                          | Valor                                                                                                                                                                                   |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalidad                      | Permitir al entrenador registrar fichas de sus alumnos para planificar su entrenamiento.                                                                                                |
| Base jurídica                  | Art. 6.1.f (interés legítimo del entrenador como responsable). TenPlanner actúa como encargado (art. 28).                                                                               |
| Categorías de interesados      | Alumnos de los entrenadores (personas físicas).                                                                                                                                         |
| Categorías de datos            | Identificativos (nombre, email), perfil físico (género, fecha nacimiento, altura, peso, mano dominante), perfil deportivo (nivel, experiencia, foto), histórico de sesiones y feedback. |
| Destinatarios                  | Supabase, Vercel. Anthropic solo si el entrenador usa Dr. Planner refiriéndose a ese alumno.                                                                                            |
| Transferencias internacionales | Idem anterior.                                                                                                                                                                          |
| Plazo de supresión             | Mientras el alumno esté en la ficha del entrenador. Baja manual por el entrenador o borrado de cuenta cascada.                                                                          |
| Medidas técnicas               | RLS por `coach_id`. Tokens temporales (7 días) para formulario público.                                                                                                                 |

## Actividad 3 — Recogida directa del perfil del alumno (`/s/[token]`)

| Campo                          | Valor                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Finalidad                      | Que el alumno complete o actualice su perfil físico/deportivo.                                                                    |
| Base jurídica                  | Art. 6.1.a RGPD (consentimiento). Art. 9.2.a si los datos físicos se consideran de salud.                                         |
| Categorías de interesados      | Alumnos con enlace vigente.                                                                                                       |
| Categorías de datos            | Los aportados por el propio alumno (altura, peso, etc.). Registro del consentimiento (timestamp + versión de aviso).              |
| Destinatarios                  | Supabase, Vercel.                                                                                                                 |
| Transferencias internacionales | Idem.                                                                                                                             |
| Plazo de supresión             | Enlace válido 7 días. Datos del alumno conservados como en Actividad 2. Token borrado automáticamente al caducar vía cron diario. |
| Medidas técnicas               | Token único por alumno, single-use conceptual, expira automáticamente, age gate server-side 14+.                                  |

## Actividad 4 — Asistente IA «Dr. Planner»

| Campo                          | Valor                                                                                                                         |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Finalidad                      | Generar sugerencias de sesiones usando el contexto conversacional del entrenador.                                             |
| Base jurídica                  | Art. 6.1.b — ejecución de contrato con el entrenador.                                                                         |
| Categorías de interesados      | Entrenador (directa) y potencialmente alumnos (si el entrenador los menciona).                                                |
| Categorías de datos            | Texto libre de la conversación. Puede incluir nombre, nivel, notas del entrenador.                                            |
| Destinatarios                  | Anthropic (modelo Claude, EE. UU.).                                                                                           |
| Transferencias internacionales | EE. UU. vía SCC en DPA Anthropic.                                                                                             |
| Plazo de supresión             | Mensajes purgados a los 180 días de inactividad del chat. Anthropic: Zero Data Retention solicitado (no almacena peticiones). |
| Medidas técnicas               | Purgado automático vía `/api/cron/cleanup` diario. Aviso a los entrenadores recomendando uso de iniciales/apodos.             |

## Actividad 5 — Seguridad y operación

| Campo                     | Valor                                                   |
| ------------------------- | ------------------------------------------------------- |
| Finalidad                 | Prevención de fraude, análisis de incidencias técnicas. |
| Base jurídica             | Art. 6.1.f — interés legítimo.                          |
| Categorías de interesados | Todos los usuarios.                                     |
| Categorías de datos       | IP, logs de autenticación, metadatos de request.        |
| Destinatarios             | Supabase, Vercel.                                       |
| Plazo de supresión        | 12 meses (retención del proveedor).                     |
| Medidas técnicas          | Acceso restringido a los logs al titular.               |

## Actividad 6 — Analítica web agregada (Vercel Analytics)

| Campo                           | Valor                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Finalidad                      | Medir visitas y uso de la web (páginas vistas, país aproximado, dispositivo) para mejorar el producto.                                                       |
| Base jurídica                  | Art. 6.1.f RGPD — interés legítimo. No usa cookies ni identifica a la persona individual, por lo que no requiere consentimiento previo (art. 22.2 LSSI-CE).  |
| Categorías de interesados      | Visitantes de la web (con o sin cuenta).                                                                                                                      |
| Categorías de datos            | Página vista, referrer, país aproximado (derivado de IP, no almacenada), tipo de dispositivo/navegador. Agregado, no vinculado a `user_id` ni a cookies.      |
| Destinatarios                  | Vercel Inc. (Vercel Analytics, parte del hosting).                                                                                                            |
| Transferencias internacionales | EE. UU. vía SCC (cubiertas por DPA de Vercel).                                                                                                                |
| Plazo de supresión             | Retención agregada según plan de Vercel (no hay perfil individual que suprimir).                                                                              |
| Medidas técnicas               | Sin cookies, sin fingerprinting, sin almacenamiento de IP completa. `<Analytics />` de `@vercel/analytics` en `app/layout.tsx`.                                |

Actualiza también `docs/legal/subprocessors.md` (fila Vercel) y `/privacidad` + `/cookies` si cambia el alcance de esta analítica.

---

## Evaluación de impacto (PIA/EIPD)

No se ha realizado EIPD formal porque:

- El volumen y perfilado es bajo.
- No se procesa a gran escala categorías especiales del art. 9.
- No hay decisiones automatizadas con efecto jurídico sobre el interesado.

Si la plataforma escala (>5.000 alumnos, uso masivo de Dr. Planner con datos de salud inferidos), revisar obligación de EIPD según lista AEPD.
