# Prompt: gestor de torneos en la landing

Para pegar en una sesión nueva de Claude Code, abierta en el repo (`app/`). Hay una versión en español y otra en inglés; son equivalentes.

---

## Español

Trabajas en Ten Planner (tenplanner.com), un planificador **solo de tenis** para **clubes, monitores y jugadores**. Lee `CLAUDE.md` y `docs/handoff.md` antes de empezar. Respuestas cortas, conclusión primero, y avisa de todo lo que no hayas podido comprobar.

**Objetivo.** Añadir a la landing pública (`/`) la información del **gestor de torneos**, y reenfocar el mensaje de la landing a tres públicos: clubes, monitores y jugadores de tenis.

**Qué hace el gestor de torneos (solo lo que ya existe en el código; no inventes nada más):**
- Crear torneos de club o de monitor, públicos o privados.
- Formatos: cuadro eliminatorio y liguilla, con cabezas de serie, marcador (normal, no presentado, retirada) y campeón.
- Circuitos con puntos y clasificación pública (`/t/c/<slug>`).
- Página pública del torneo (`/t/<slug>`) con inscripción por enlace y cancelación.
- Cartel en PDF con tres plantillas, imagen propia y código QR.
- Orden de juego (día, hora, pista) y reserva automática de las pistas del torneo en Reservas.
- Noticias y fotos con etiquetas y aviso de imagen; consentimiento de las familias.
- Archivar torneos terminados.

**Qué hacer:**
1. Lee `components/landing/tenplanner-landing.tsx`, `lib/landing-content.ts` y `app/page.tsx`. Los textos editables se guardan en `landing_content` con el prefijo `v2_` y se editan en `/admin/landing`. Cualquier texto nuevo debe seguir ese mecanismo (campo en `LANDING_FIELD_DEFINITIONS` con valor por defecto), no ir escrito a mano.
2. Añade una sección «Torneos» entre Funcionalidades y la biblioteca (o donde encaje mejor, justifícalo en una línea), con título, descripción corta y 4 a 6 tarjetas del gestor. Mismo diseño que el resto (negro, lima, crema); no cambies la identidad visual.
3. Reenfoca el texto de la landing a **clubes, monitores y jugadores**: etiqueta superior, subtítulo, y una franja corta «Para quién» con tres tarjetas (club, monitor, jugador). Todo es tenis: no menciones pádel ni pickleball.
4. Un botón de la sección lleva a un torneo público de ejemplo si existe uno publicado; si no, a `/register`. No enlaces a nada privado.
5. Pásalo todo por el editor del admin cuando sea texto de portada.

**Reglas:**
- Nada de cifras ni testimonios sin respaldo (nada de «Más de N monitores»). No prometas precios ni funciones que no estén en la lista de arriba.
- Datos de clientes nunca públicos: no muestres nombres reales de inscritos ni familias en la landing.
- No borres secciones, ejercicios ni clases sin permiso.
- Trabaja en una rama nueva desde `main` (worktree). **No hagas push a `main` ni publiques sin mi confirmación**; cada push a `main` publica en tenplanner.com.
- Si el cambio añade campos al editor, no hace falta migración: se guardan en `landing_content` como filas nuevas.

**Cómo comprobarlo:** `tsc` y ESLint sin errores; arranca `preview_start` y revisa escritorio y móvil (375 px), con el cartel y las tarjetas. Si usas la base de datos de pruebas (`xiqppj…`), no la real (`pitsas…`). Dime qué no pudiste comprobar.

---

## English

You are working on Ten Planner (tenplanner.com), a **tennis-only** planner for **clubs, coaches and players**. Read `CLAUDE.md` and `docs/handoff.md` first. Keep answers short, conclusion first, and flag anything you could not verify.

**Goal.** Add the **tournament manager** to the public landing page (`/`) and refocus the landing message on three audiences: clubs, coaches and tennis players.

**What the tournament manager does (only what already exists in the code; do not invent anything else):**
- Create club or coach tournaments, public or private.
- Formats: knockout bracket and round robin, with seeding, scores (normal, walkover, retirement) and a champion.
- Circuits with points and a public standings page (`/t/c/<slug>`).
- Public tournament page (`/t/<slug>`) with sign-up and cancellation by link.
- PDF poster with three templates, a custom image and a QR code.
- Schedule (day, time, court) and automatic court booking in Reservations.
- News and photos with tags and an image notice; family consent.
- Archive finished tournaments.

**What to do:**
1. Read `components/landing/tenplanner-landing.tsx`, `lib/landing-content.ts` and `app/page.tsx`. Editable copy is stored in `landing_content` with the `v2_` prefix and edited at `/admin/landing`. Any new copy must use that mechanism (a field in `LANDING_FIELD_DEFINITIONS` with a default value), not be hardcoded.
2. Add a "Tournaments" section between Features and the library (or wherever fits best; justify it in one line), with a title, a short description and 4 to 6 cards for the manager. Same look as the rest (black, lime, cream); do not change the visual identity.
3. Refocus the landing copy on **clubs, coaches and players**: top badge, subtitle, and a short "Who it's for" strip with three cards (club, coach, player). Everything is tennis: do not mention padel or pickleball.
4. One button in the section links to a published public example tournament if there is one; otherwise to `/register`. Never link to anything private.
5. Route all front-page copy through the admin editor.

**Rules:**
- No figures or testimonials without evidence (no "More than N coaches"). Do not promise prices or features outside the list above.
- Customer data is never public: do not show real participant or family names on the landing.
- Do not delete sections, exercises or classes without permission.
- Work on a new branch from `main` (worktree). **Do not push to `main` or publish without my confirmation**; every push to `main` deploys to tenplanner.com.
- If the change adds editor fields, no migration is needed: they are stored in `landing_content` as new rows.

**How to verify:** `tsc` and ESLint clean; start `preview_start` and check desktop and mobile (375 px), including the cards. Use the test database (`xiqppj…`), not production (`pitsas…`). Tell me what you could not verify.
