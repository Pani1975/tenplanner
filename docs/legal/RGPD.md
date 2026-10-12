# Guía de cumplimiento RGPD / LOPDGDD — TenPlanner

Pasos concretos para cumplir con:

- **RGPD** — Reglamento (UE) 2016/679.
- **LOPDGDD** — Ley Orgánica 3/2018, de 5 de diciembre.
- **LSSI-CE** — Ley 34/2002 (comercio electrónico).
- **Directrices AEPD** 2023 sobre cookies.

Orden cronológico: lo que ya está implementado → lo que falta antes de producción → mantenimiento en operación.

---

## Fase 0 — Ya implementado en el código

No tocar salvo regresión. Referencia rápida:

- [x] RLS activa en todas las tablas con datos de usuario (`db/migrations/0013_rls_complete_policies.sql`).
- [x] Tokens `/s/[token]` con expiración 7 días + cron que los invalida (`app/api/cron/cleanup/route.ts`).
- [x] Consent tracking en formulario del alumno (`students.consent_given_at`, `students.consent_version` — migración `0014_consent_tracking.sql`).
- [x] Age gate 14+ server + cliente (`app/s/[token]/profile-form.tsx` + `actions.ts`).
- [x] Páginas legales públicas: `/privacidad`, `/aviso-legal`, `/cookies`, `/terminos`.
- [x] Banner de cookies informativo (`components/app/cookie-banner.tsx`).
- [x] Endpoint de portabilidad completo (`app/api/export/route.ts` — incluye users, students, sessions, exercises, drPlannerChats/messages).
- [x] Endpoint de supresión (`app/api/account/delete/route.ts`) con cascada DB + storage + `auth.admin.deleteUser`.
- [x] Cascada de storage al borrar alumno (`app/api/students/[id]/route.ts` DELETE).
- [x] Cron diario de retención 180 días para chats Dr. Planner (`vercel.json`).
- [x] Documentación interna: RAT, subencargados, retención, brechas, DPA (`docs/legal/`).
- [x] Analítica web agregada sin cookies (Vercel Analytics) — `app/layout.tsx`, documentada en RAT Actividad 6, `subprocessors.md` y `/privacidad` + `/cookies`.

---

## Fase 1 — Pre-despliegue (bloqueante)

### 1.1. Identidad del responsable

Rellenar los marcadores `<!-- TODO -->` en los siguientes archivos. Hasta que tengan valores reales, las páginas legales son inválidas.

| Archivo                            | Campos                                                              |
| ---------------------------------- | ------------------------------------------------------------------- |
| `app/(legal)/privacidad/page.tsx`  | Titular, NIF/CIF, domicilio, email de contacto, DPO (si aplica).    |
| `app/(legal)/aviso-legal/page.tsx` | Denominación, NIF, domicilio, email, registro mercantil.            |
| `app/(legal)/terminos/page.tsx`    | No hay placeholders, pero revisar referencia al email de supresión. |
| `docs/legal/RAT.md`                | Bloque de identidad del responsable.                                |
| `docs/legal/subprocessors.md`      | Estado de cada DPA firmado.                                         |
| `docs/legal/breach-procedure.md`   | Nombre del coordinador y DPO.                                       |
| `README.md`                        | Sección checklist.                                                  |

Comando rápido para localizar todo:

```bash
grep -rn "TODO" app/(legal)/ docs/legal/ README.md
```

### 1.2. Firmar DPAs con encargados

Cada proveedor necesita contrato de encargo art. 28 RGPD firmado y conservado.

1. **Supabase** → panel `Organization settings → DPA`. Firmar con datos de la entidad responsable. Link: <https://supabase.com/privacy/dpa>.
2. **Anthropic** → enviar formulario desde <https://www.anthropic.com/legal/dpa> con NIF + firmante. En el mismo correo, solicitar Zero Data Retention: `privacy@anthropic.com`, asunto _"Request for Zero Data Retention policy"_.
3. **Vercel** → `Account → Legal → Data Processing Agreement`. Link: <https://vercel.com/legal/dpa>.
4. **Pexels** → no procesa datos personales (solo términos de búsqueda). No requiere DPA.

Guardar PDFs firmados fuera del repo (o en repo privado). Actualizar `docs/legal/subprocessors.md` con fecha de firma.

### 1.3. Variables de entorno en Vercel

Añadir en `Project → Settings → Environment Variables` (scope: Production + Preview):

| Variable                                                                                              | Obligatoria en prod                              |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `SUPABASE_SERVICE_ROLE_KEY`                                                                           | ✅ — sin ella no funciona `/api/account/delete`. |
| `CRON_SECRET`                                                                                         | ✅ — sin ella el cron devuelve 500.              |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `DATABASE_URL`, `NEXT_ANTHROPIC_API_KEY` | ya existentes.                                   |

Rotar `SUPABASE_SERVICE_ROLE_KEY` si alguna vez se expone. Nunca prefijar `NEXT_PUBLIC_`.

### 1.4. Aplicar la migración de consentimiento

```bash
pnpm db:migrate
```

Verifica:

```sql
SELECT column_name FROM information_schema.columns
  WHERE table_name = 'students'
  AND column_name IN ('consent_given_at', 'consent_version');
```

Debe devolver 2 filas.

### 1.5. Configurar cron

Ya está en `vercel.json`. Al deplegar, Vercel lo registra automáticamente. Comprobar en `Project → Settings → Cron Jobs` que aparece `/api/cron/cleanup` con schedule `0 3 * * *`. Plan Hobby no ejecuta crons diarios fiables: usar Pro o mover a Supabase Scheduled Functions / GitHub Actions con `curl`.

### 1.6. Storage buckets — revisar visibilidad

En Supabase dashboard → Storage:

- **avatars**: hoy marcado _Public_ → cualquiera con URL ve la imagen. Para fotos de alumnos (pueden ser menores) es riesgo.
  - Opción A — mínimo esfuerzo: aceptar y documentar en `/privacidad`.
  - Opción B — recomendada: marcar bucket como _Private_ y generar signed URLs en server components para el coach. Requiere tocar `app/(app)/students/...` y `app/(app)/profile/profile-client.tsx`.
- **exercise-media**: si solo contiene imágenes de ejercicios genéricos (no rostros), _Public_ es aceptable.

Decisión documentada en `docs/legal/subprocessors.md` (columna "Garantías extra").

### 1.7. Antes del primer deploy: smoke test manual

Checklist de aceptación:

- [ ] `/privacidad`, `/aviso-legal`, `/cookies`, `/terminos` cargan sin login.
- [ ] Banner de cookies aparece en primera visita y persiste el dismiss.
- [ ] Registro y login funcionan.
- [ ] `/s/<token>` con fecha <14 bloquea submit con mensaje claro.
- [ ] Sin marcar checkbox de consentimiento, submit falla.
- [ ] Tras submit exitoso, `SELECT consent_given_at FROM students WHERE id = ...` tiene timestamp.
- [ ] Perfil → Datos → Exportar JSON descarga archivo con todos los campos (users, students, sessions, chats).
- [ ] Perfil → Datos → Eliminar cuenta con escribir "ELIMINAR" → cuenta desaparece en `auth.users`, filas en DB borradas, archivos de `avatars/` removidos.
- [ ] `curl -H "Authorization: Bearer $CRON_SECRET" https://<prod>/api/cron/cleanup` → 200 con resumen.

---

## Fase 2 — Registro en la AEPD (solo si aplica)

No hay obligación general de notificar ficheros a la AEPD desde el RGPD. Pero sí:

- **Designar DPO** si hay tratamiento a gran escala de categorías especiales (art. 37 RGPD). Umbral orientativo: >5.000 interesados o datos de salud sistemáticos. Si TenPlanner escala a clubs grandes, revisar.
- **Inscribir DPO** en la AEPD mediante formulario: <https://sedeagpd.gob.es/sede-electronica-web/vistas/formDelegadosProteccionDatos/procedimientoDelegadosProteccionDatos.jsf>.
- **Canal de reclamaciones AEPD** — no requiere inscripción previa. Los usuarios reclaman directamente en <https://www.aepd.es>.

---

## Fase 3 — Operación continua

### 3.1. Mantenimiento del RAT

Actualizar `docs/legal/RAT.md` cada vez que:

- Se añada/quite un subencargado (Analytics, email provider, etc.).
- Cambie una finalidad (p. ej. nuevo módulo de pagos, chat con alumnos).
- Cambie un plazo de conservación.
- Se produzca brecha documentada (referencia cruzada).

Revisión mínima obligatoria: **anual**.

### 3.2. Responder a derechos (ARCOPOL)

Plazo máximo: 30 días (prorrogable a 60 con justificación). Canal: email publicado en `/privacidad`.

| Derecho                                        | Acción técnica                                                                                                                                                                                         |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Acceso                                         | Generar export JSON vía `/api/export` logueado como el interesado; enviarlo.                                                                                                                           |
| Rectificación                                  | El usuario puede hacerlo desde Perfil. Si afecta a alumno, el coach lo edita.                                                                                                                          |
| Supresión                                      | El usuario usa Perfil → Datos → Eliminar cuenta. Si es alumno: el coach borra la ficha. Si el alumno pide directamente supresión a TenPlanner: identificar al coach, pedirle borrado, verificar en DB. |
| Portabilidad                                   | Mismo export JSON.                                                                                                                                                                                     |
| Oposición                                      | Detener el tratamiento basado en interés legítimo. Documentar la decisión en ticket.                                                                                                                   |
| Limitación                                     | Marcar cuenta como "restringida" (no hay flag aún — si surge, añadir columna `users.restricted_at`).                                                                                                   |
| No discriminación por decisiones automatizadas | No hay: Dr. Planner propone, el coach confirma.                                                                                                                                                        |

Cada solicitud se registra en un log interno (`docs/legal/dsar-log.md` — crear al atender la primera) con fecha, identidad, tipo, respuesta.

### 3.3. Revisión anual

Tarea recurrente (calendario compartido):

1. Releer `docs/legal/RAT.md` y `subprocessors.md`. Marcar obsoletos.
2. Comprobar que las páginas legales siguen coherentes con la implementación.
3. Simulacro de brecha (`breach-procedure.md` §6).
4. Verificar cron `cleanup` ejecutándose (logs Vercel).
5. Auditar permisos RLS ejecutando queries con roles reducidos.
6. Revisar `pnpm audit` y actualizar dependencias con vulnerabilidades.
7. Revisar retención de backups en Supabase (depende del plan).

### 3.4. Auditoría de logs

Trimestral. Verificar que `console.log` / `console.info` del servidor no loguean:

- Emails completos.
- Nombres de alumnos.
- Contenido del chat de Dr. Planner.

Grep recomendado:

```bash
grep -rn "console\.\(log\|info\|warn\|error\)" app/ lib/ | grep -v "cron/cleanup"
```

### 3.5. Dependencias críticas y avisos

- Anthropic cambia política de retención → revisar DPA y ZDR activo.
- Supabase cambia región por defecto → confirmar que la BBDD sigue en UE.
- Vercel cambia proveedores CDN → confirmar SCC vigentes.

---

## Fase 4 — Gestión de brechas

Flujo abreviado; detalle completo en `breach-procedure.md`.

```
Detección
  → Log interno (timestamp, síntoma, sistemas)
  → Contención en ≤ 1 h (rotar claves, revocar sesiones)
  → Evaluación de riesgo en ≤ 24 h
  → Si riesgo NO-improbable: notificación AEPD en ≤ 72 h
      https://sedeagpd.gob.es/.../formBrechaSeguridad
  → Si riesgo ALTO: comunicación a interesados sin dilación
  → Post-mortem en ≤ 30 días
  → Actualizar procedimiento si procede
```

**Artefactos obligatorios**: log interno de brechas (`docs/legal/breach-log.md`, crear al primer incidente), aunque no se notifique a la AEPD.

---

## Fase 5 — Cambios que disparan nuevos requisitos

Si el roadmap incluye alguno de estos, re-evaluar:

| Cambio                                                | Requisito añadido                                                                                |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Analytics con cookies o identificación individual (GA4, Plausible con cookies, etc.). | Banner granular (opt-in), actualizar `/cookies`, añadir proveedor a RAT. (Vercel Analytics, al ser cookieless y agregado, ya está implementado sin opt-in — ver Fase 0 y RAT Actividad 6; si se cambia por una herramienta que use cookies o identifique personas, aplicar esta fila.) |
| Pagos (Stripe, etc.).                                 | Datos de facturación = nueva finalidad en RAT. Plazo conservación fiscal 6 años (Cód. Comercio). |
| Email marketing.                                      | Consentimiento separado, opt-in doble, proveedor en RAT, opción de baja.                         |
| Datos de menores <14.                                 | Mecanismo verificable de consentimiento parental (art. 8.2 RGPD). Re-diseñar flow `/s/[token]`.  |
| Datos de salud explícitos (lesiones, patologías).     | Base del art. 9 RGPD. Posible EIPD. Consultar DPO / asesor legal.                                |
| Operación fuera de UE.                                | Normativa local (CCPA, LGPD…). Re-evaluar SCC.                                                   |
| Integración con IA de terceros distinta de Anthropic. | DPA nuevo + ZDR + actualizar RAT.                                                                |

---

## Fase 6 — Escalado: EIPD

Hay que hacer Evaluación de Impacto en Protección de Datos cuando:

- Tratamiento a gran escala de categorías especiales (art. 9).
- Uso sistemático de nuevas tecnologías con alto riesgo.
- Perfilado con efectos legales o significativos.
- Lista AEPD 2019: <https://www.aepd.es/sites/default/files/2019-09/listas-dpia.pdf>.

Umbral práctico para TenPlanner: >5.000 alumnos activos o uso masivo de Dr. Planner procesando datos de salud. Documentar EIPD en `docs/legal/EIPD-<fecha>.md` siguiendo plantilla AEPD.

---

## Checklist final

```
Pre-despliegue
[ ] Rellenar todos los <!-- TODO --> de páginas legales y docs.
[ ] Firmar DPA Supabase, Anthropic, Vercel.
[ ] Solicitar ZDR a Anthropic.
[ ] Configurar SUPABASE_SERVICE_ROLE_KEY y CRON_SECRET en Vercel.
[ ] Aplicar migración 0014_consent_tracking.sql.
[ ] Decidir visibilidad de buckets de storage (documentar).
[ ] Smoke test manual de los 8 flujos de Fase 1.7.

Primera semana en producción
[ ] Verificar cron ejecutándose.
[ ] Verificar que no hay PII en logs.
[ ] Confirmar que backups Supabase siguen plan contratado.

Operación continua
[ ] Revisión anual del RAT (fecha recordatorio: +12 meses).
[ ] Simulacro de brecha anual.
[ ] Trimestral: auditoría de logs + pnpm audit.
[ ] Cada release: revisar que no se introducen nuevas finalidades sin actualizar RAT.
```

---

## Referencias oficiales

- RGPD: <https://eur-lex.europa.eu/eli/reg/2016/679/oj>
- LOPDGDD: <https://www.boe.es/eli/es/lo/2018/12/05/3>
- LSSI-CE: <https://www.boe.es/eli/es/l/2002/07/11/34>
- AEPD — inicio: <https://www.aepd.es>
- AEPD — sede electrónica: <https://sedeagpd.gob.es>
- Plantillas AEPD (RAT, EIPD, brechas): <https://www.aepd.es/guias>
- EDPB directrices: <https://edpb.europa.eu/edpb_en>
