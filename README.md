# Centro de Operaciones · Edición Agencia

El panel para manejar tu agencia de diseño web desde un solo lugar:

- **Agencia**: proyectos de clientes con etapas, hitos y tareas, y las estadísticas de tu web.
- **Portal de clientes**: cada cliente entra con su usuario y ve el avance, completa el briefing, descarga entregables, carga accesos (cifrados) y ve sus facturas y pagos.
- **Leads y CRM**: pipeline comercial (Nuevo → Contactado → En conversación → Cotizado → Ganado/Perdido), seguimientos, importación de CSV y formulario de tu web conectado.
- **Finanzas**: presupuesto mensual, ingresos (facturas de clientes y cargas manuales), gastos y flujo de caja.
- **Tareas**: bandeja, "hoy" y tablero.
- **Contenido**: métricas de Instagram y TikTok, ideas y guiones de reels con IA, transcripción de videos e inspiración de referentes.

Cada persona instala **su propia copia**: tus datos y los de tus clientes quedan en tu base de datos y nadie más los ve.

---

## Instalación (unos 15 minutos, sin programar)

Vas a necesitar cuentas gratis en **GitHub**, **Vercel** y **Neon**.

### 1. Copiar el proyecto a tu GitHub

En la página de este repositorio tocá **Use this template → Create a new repository**. Ponele un nombre (ej. `mi-panel`) y dejalo **privado**.

### 2. Importarlo en Vercel

1. Entrá a [vercel.com/new](https://vercel.com/new) y elegí el repositorio que acabás de crear.
2. **Todavía no toques Deploy.** Primero abrí **Environment Variables** y cargá estas cuatro:

| Variable | Qué poner |
|---|---|
| `APP_PASSWORD` | La contraseña con la que vas a entrar a tu panel. |
| `SESSION_SECRET` | Un texto largo al azar. Abrí [este link](https://generate-secret.vercel.app/64) y copiá lo que aparece. |
| `ENCRYPTION_KEY` | **Otro** valor del mismo link (recargá la página para que cambie). Tiene que tener 64 caracteres. No lo cambies nunca después: es lo que cifra los accesos de tus clientes. |
| `NEXT_PUBLIC_AGENCY_NAME` | El nombre de tu agencia. |

Opcionales recomendadas: `NEXT_PUBLIC_OWNER_NAME` (tu nombre, para el saludo) y `LEGAL_CONTACT_EMAIL`.

3. Tocá **Deploy**. El primer deploy **va a fallar** porque todavía no hay base de datos. Es normal.

### 3. Crear la base de datos

1. En tu proyecto de Vercel: **Storage → Create Database → Neon (Serverless Postgres)** → Create.
2. Conectala al proyecto. Vercel carga `DATABASE_URL` sola.
3. Andá a **Deployments**, tocá los tres puntos del último deploy y elegí **Redeploy**.

En cada deploy el panel crea o actualiza las tablas solo y deja lista la unidad de tu agencia.

### 4. Entrar

Abrí la URL que te da Vercel (ej. `mi-panel.vercel.app`) y entrá con tu `APP_PASSWORD`.

Por último, cargá `NEXT_PUBLIC_APP_URL` con esa URL (sin barra al final) y volvé a hacer Redeploy.

> Las variables que empiezan con `NEXT_PUBLIC_` se aplican recién en el próximo deploy. Si cambiás el nombre de la agencia, hacé Redeploy.

---

## Activar los módulos opcionales

Cada módulo se activa cuando cargás sus variables en **Vercel → Settings → Environment Variables** y hacés Redeploy. La lista completa, con qué es cada una, está en [`.env.example`](.env.example).

| Módulo | Variables |
|---|---|
| Formulario de tu web → Leads | `LEADS_ALLOWED_ORIGINS`, `WEB3FORMS_ACCESS_KEY` |
| Estadísticas de Google Analytics y agenda de Google Calendar | `GA_SERVICE_ACCOUNT_EMAIL`, `GA_SERVICE_ACCOUNT_PRIVATE_KEY`, `GOOGLE_CALENDAR_IDS` |
| Ideas y guiones de reels con IA | `ANTHROPIC_API_KEY` |
| Transcripción de videos | `GROQ_API_KEY` |
| Instagram | `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET` |
| Inspiración (referentes de Instagram) | `META_APP_ID`, `META_APP_SECRET`, `META_LOGIN_CONFIG_ID` |
| TikTok | `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` |

Instagram, Inspiración y TikTok necesitan que crees tu propia app de desarrollador en Meta y en TikTok. Para eso las apps piden una política de privacidad y términos, que ya vienen incluidos: usá `https://tu-dominio/privacidad` y `https://tu-dominio/terminos`.

### Portal de clientes

En **Agencia → Portal de clientes** creás el usuario de cada cliente. Ellos entran en `https://tu-dominio/portal`.

### Formulario de tu web

Tu formulario tiene que mandar un `POST` a `https://tu-dominio/api/webhooks/leads`. El lead entra solo al CRM con origen "Formulario web".

---

## Para desarrolladores

```bash
cp .env.example .env.local   # completar DATABASE_URL y las obligatorias
npm install
npm run setup                # migraciones + datos iniciales
npm run dev
```

- Next.js 15 (App Router), Drizzle ORM y Neon Postgres.
- El esquema vive en `src/db/schema.ts`. Para cambiarlo, corré `npm run db:generate` y después `npm run db:migrate`.
- Las etapas del pipeline del CRM se editan en `src/lib/crm/unidades.ts`.
