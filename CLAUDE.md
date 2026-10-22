@AGENTS.md

# Centro de Operaciones · Edición Agencia

Panel interno de una agencia de diseño web + portal para sus clientes.
Next.js 15 (App Router, server actions), Drizzle ORM, Postgres en Neon, Tailwind 4.
Se despliega en Vercel. Quien lo usa probablemente no programa: explicale los
cambios en lenguaje simple y en español.

## Instalación asistida

Si la persona te pide instalar o correr este repo, guiala con estos pasos, de a
uno, explicando qué hace cada uno. Las cuentas y contraseñas las pone ella: vos
abrís los logins (se abren en su navegador) y esperás.

1. **Requisitos**: `node -v` (20 o más) y `git`. Si falta Node, indicale
   descargarlo de nodejs.org.
2. **Su propia copia del repo** (no clones el original: necesita un repo suyo
   para publicar y guardar cambios). Con GitHub CLI logueado (`gh auth login`):
   `gh repo create <nombre> --template ginopattiweb-oss/centro-operaciones-agency --private --clone`.
   Sin `gh`: que toque "Use this template" en GitHub y después clonás ese repo.
3. `npm install`.
4. **Base de datos Neon**: `npx neonctl@latest auth` (login en el navegador),
   `npx neonctl@latest projects create --name <nombre> --region-id aws-sa-east-1`
   y `npx neonctl@latest connection-string --project-id <id>`. Alternativa: que
   cree el proyecto en neon.tech y te pegue el connection string.
5. **`.env.local`** a partir de `.env.example`:
   - `DATABASE_URL`: el del paso 4.
   - `SESSION_SECRET` y `ENCRYPTION_KEY`: uno distinto cada uno, con `openssl rand -hex 32`.
   - `APP_PASSWORD` y `NEXT_PUBLIC_AGENCY_NAME`: preguntale.
   - Pedile que guarde `ENCRYPTION_KEY` en un lugar seguro: si se pierde o se
     cambia, no se pueden leer los accesos de clientes ya cargados.
6. `npm run setup` (tablas + datos iniciales) y `npm run dev`. Que entre a
   http://localhost:3000 con su `APP_PASSWORD`.
7. **Publicar** (sin esto sus clientes no pueden entrar al portal):
   `npx vercel@latest login`, `npx vercel@latest link` (proyecto nuevo),
   `npx vercel@latest git connect` para que cada push despliegue solo, cargar
   cada variable de `.env.local` con
   `printf '%s' "<valor>" | npx vercel@latest env add <NOMBRE> production`, y
   `npx vercel@latest --prod`. Después, `NEXT_PUBLIC_APP_URL` con la URL final y
   otro `--prod`.
8. `git push` de lo que haya cambiado (nunca subas `.env.local`: ya está en `.gitignore`).

## Mapa

| Qué | Dónde |
|---|---|
| Esquema de la base | `src/db/schema.ts` (relaciones en `src/db/relations.ts`) |
| Datos iniciales (idempotente) | `src/db/seed.ts` |
| Escrituras (server actions) | `src/lib/actions/*.ts` |
| Lecturas | `src/lib/*-queries.ts`, `src/lib/crm/queries.ts` |
| Panel interno | `src/app/(dashboard)/` |
| Unidad agencia: proyectos, leads, finanzas por proyecto | `src/app/(dashboard)/unidad/agencia/` |
| Portal de clientes | `src/app/portal/`, `src/components/portal/` |
| CRM | `src/lib/crm/`, `src/components/crm/`, `src/app/(dashboard)/crm/` |
| Etapas del pipeline del CRM | `src/lib/crm/unidades.ts` (único lugar) |
| Textos y estados de leads | `src/lib/leads-config.ts` |
| Estados de proyectos de cliente | `src/lib/proyecto-estados.ts` |
| Nombre de la agencia / dueño / URL | `src/lib/marca.ts` (variables de entorno) |
| Contenido (Instagram, TikTok, IA) | `src/app/(dashboard)/contenido/`, `src/lib/instagram*.ts`, `src/lib/tiktok*.ts`, `src/lib/contenido-*.ts`, `src/lib/trial-reels.ts` |
| Formulario web → leads | `src/app/api/webhooks/leads/route.ts` |
| Login y sesiones | `src/middleware.ts`, `src/lib/auth*.ts`, `src/lib/portal-auth.ts` |
| Sistema visual | `src/app/globals.css` (tokens), `/design-system` |

## Reglas que no se rompen

**Seguridad**
- Toda server action del panel interno arranca con `await requireAdmin()`.
- Todo lo del portal pasa por `requirePortalContext()` y filtra por el
  `clientProjectId` de la sesión. Un cliente NUNCA puede ver datos de otro.
- Los accesos de clientes y los tokens se guardan cifrados con `src/lib/crypto.ts`.
  Nunca guardes una contraseña o token en texto plano.
- Nunca pongas claves, contraseñas ni datos reales en el código: van en variables
  de entorno y se documentan en `.env.example`.

**Base de datos**
- Para cambiar tablas: editá `src/db/schema.ts` y corré `npm run db:generate`.
  Eso crea un archivo nuevo en `drizzle/`. No hace falta conexión a la base.
- NUNCA edites ni borres una migración que ya existe en `drizzle/`: ya se aplicó
  en la base de producción. Siempre una migración nueva.
- Lo que drizzle no expresa (CHECKs, índices parciales, triggers) va en una
  migración custom: `npx drizzle-kit generate --custom --name algo`.
- Las migraciones se aplican solas en cada deploy de Vercel (`vercel-build`).
  Preferí cambios que agregan (columna nueva nullable o con default) a cambios
  que borran o renombran: borrar una columna borra datos reales. Si el cambio
  borra o transforma datos, avisá ANTES de hacerlo y explicá qué se pierde.
- Si una tabla nueva tiene `updated_at`, agregale el trigger `set_updated_at()`
  en una migración custom (ver `drizzle/0002_restricciones.sql`).

**Código**
- Textos de la interfaz en español rioplatense, mismo tono que el resto.
- Seguí el estilo de los archivos vecinos: mismos componentes, mismos tokens
  de color (`var(--...)`, clases `text-fg`, `bg-surface`), misma densidad de comentarios.
- Validá entradas de server actions con Zod, como hacen las existentes.
- Fechas: usá los helpers de `src/lib/date.ts` (zona horaria Buenos Aires).

## Antes de dar un cambio por terminado

```bash
npx tsc --noEmit   # tipos
npm run lint       # estilo
```

Después del push, Vercel genera un deploy. Decile a la persona qué tiene que
probar en el panel para confirmar que el cambio funciona.
