# TenPlanner

Plan your goals, track your progress.

## Tech Stack

- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript 5
- **UI:** React 19, Tailwind CSS 4, shadcn/ui
- **Linting:** ESLint 9, Prettier
- **Package Manager:** pnpm

## Folder Structure

```
tenplanner/
├── app/              # Next.js App Router (pages, layouts, routes)
│   ├── (legal)/      # Public legal pages (privacy, cookies, etc.)
│   └── api/
│       ├── account/delete   # RGPD supresión (art. 17)
│       ├── export           # RGPD portabilidad (art. 20)
│       └── cron/cleanup     # Retención automática
├── components/       # Shared React components
│   └── ui/           # shadcn/ui primitives
├── lib/              # Utility functions and shared logic
├── db/               # Database schema, migrations, queries
├── docs/
│   └── legal/        # Documentación RGPD interna (RAT, DPA, brechas…)
├── public/           # Static assets
└── .github/
    └── workflows/    # CI pipeline (lint + type-check on PRs)
```

## Getting Started

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Command             | Description                  |
| ------------------- | ---------------------------- |
| `pnpm dev`          | Start dev server             |
| `pnpm build`        | Production build             |
| `pnpm lint`         | Run ESLint                   |
| `pnpm format`       | Format code with Prettier    |
| `pnpm format:check` | Check formatting             |
| `pnpm typecheck`    | Run TypeScript type checking |
| `pnpm db:generate`  | Generate Drizzle migration   |
| `pnpm db:migrate`   | Apply pending migrations     |

## Environment variables

Copy `.env.example` to `.env.local` and fill in:

| Variable                        | Required        | Purpose                                                                                                       |
| ------------------------------- | --------------- | ------------------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | ✅              | Supabase project URL.                                                                                         |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅              | Supabase anon (client-safe) key.                                                                              |
| `SUPABASE_SERVICE_ROLE_KEY`     | ✅ (producción) | Service-role key. **Solo servidor.** Necesaria para el endpoint de borrado de cuenta (`/api/account/delete`). |
| `DATABASE_URL`                  | ✅              | Postgres connection string para Drizzle.                                                                      |
| `NEXT_ANTHROPIC_API_KEY`        | ✅              | Clave API de Anthropic (Dr. Planner).                                                                         |
| `CRON_SECRET`                   | ✅ (producción) | Bearer token para autenticar `/api/cron/cleanup`. Vercel lo pasa automáticamente si está configurado.         |
| `NEXT_DEV_ALLOWED_ORIGINS`      | opcional        | Lista de orígenes permitidos en dev.                                                                          |

## CI

Every PR runs lint, Prettier check, and type-check via GitHub Actions.

## RGPD — checklist pre-producción

> Esta aplicación trata datos personales de terceros (alumnos) por cuenta del entrenador. Antes de desplegar en producción debe completarse la capa legal.

- [ ] Rellenar los placeholders `<!-- TODO -->` en:
  - `app/(legal)/privacidad/page.tsx`
  - `app/(legal)/aviso-legal/page.tsx`
  - `app/(legal)/terminos/page.tsx`
  - `docs/legal/RAT.md`, `docs/legal/subprocessors.md`, `docs/legal/breach-procedure.md`, `docs/legal/DPA-template.md`.
- [ ] Firmar/aceptar DPAs desde los paneles de:
  - [Supabase DPA](https://supabase.com/privacy/dpa)
  - [Anthropic DPA](https://www.anthropic.com/legal/dpa)
  - [Vercel DPA](https://vercel.com/legal/dpa)
- [ ] Solicitar **Zero Data Retention** a Anthropic (`privacy@anthropic.com`). Sin ZDR, el proveedor retiene peticiones hasta 30 días.
- [ ] Configurar las variables de entorno `SUPABASE_SERVICE_ROLE_KEY` y `CRON_SECRET` en el panel de Vercel.
- [ ] Aplicar la migración `0014_consent_tracking.sql` en producción (`pnpm db:migrate`).
- [ ] Verificar que el cron `/api/cron/cleanup` está activo (Vercel → Settings → Cron Jobs).
- [ ] Revisar y mantener `docs/legal/RAT.md` tras cualquier cambio que añada nuevas finalidades o subencargados.
- [ ] Si se añade analítica (Vercel Analytics, Plausible, GA4): reactivar consentimiento granular en `components/app/cookie-banner.tsx`.

### Recursos internos

- **RAT, subencargados, retención, brechas, DPA:** `docs/legal/`.
- **Autoridad de control:** [Agencia Española de Protección de Datos (AEPD)](https://www.aepd.es).


