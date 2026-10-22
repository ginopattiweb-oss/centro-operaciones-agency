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

## Instalación (unos 10 minutos, sin programar)

Vas a necesitar una cuenta gratis en **GitHub** y otra en **Vercel** (creala con "Continue with GitHub").

### 1. Tocar el botón

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fginopattiweb-oss%2Fcentro-operaciones-agency&project-name=mi-panel&repository-name=mi-panel&env=APP_PASSWORD%2CSESSION_SECRET%2CENCRYPTION_KEY%2CNEXT_PUBLIC_AGENCY_NAME&envDescription=Contrase%C3%B1a%20del%20panel%2C%20dos%20secretos%20de%2064%20caracteres%20y%20el%20nombre%20de%20tu%20agencia&envLink=https%3A%2F%2Fgithub.com%2Fginopattiweb-oss%2Fcentro-operaciones-agency%232-completar-las-variables&stores=%5B%7B%22type%22%3A%22integration%22%2C%22protocol%22%3A%22storage%22%2C%22integrationSlug%22%3A%22neon%22%2C%22productSlug%22%3A%22neon%22%7D%5D)

Vercel te va a guiar por tres pasos:

1. **Crear el repositorio** en tu GitHub. Dejalo **privado**: ahí van a quedar tus cambios.
2. **Crear la base de datos Neon**. Aceptá los valores por defecto y elegí la región más cerca tuyo (ej. `São Paulo` para Latinoamérica).
3. **Completar las variables** (ver abajo) y tocar **Deploy**.

### 2. Completar las variables

| Variable | Qué poner |
|---|---|
| `APP_PASSWORD` | La contraseña con la que vas a entrar a tu panel. |
| `SESSION_SECRET` | Un texto largo al azar. Abrí [este link](https://generate-secret.vercel.app/64) y copiá lo que aparece. |
| `ENCRYPTION_KEY` | **Otro** valor del mismo link (recargá la página para que cambie). Tiene que tener 64 caracteres. No lo cambies nunca después: es lo que cifra los accesos de tus clientes. |
| `NEXT_PUBLIC_AGENCY_NAME` | El nombre de tu agencia. |

En el deploy el panel crea las tablas solo y deja lista la unidad de tu agencia.

### 3. Entrar

Abrí la URL que te da Vercel (ej. `mi-panel.vercel.app`) y entrá con tu `APP_PASSWORD`.

### 4. Terminar de personalizar

En Vercel → tu proyecto → **Settings → Environment Variables**, agregá:

- `NEXT_PUBLIC_APP_URL`: la URL de tu panel, sin barra al final.
- `NEXT_PUBLIC_OWNER_NAME`: tu nombre, para el saludo.
- `LEGAL_CONTACT_EMAIL`: tu mail de contacto.

Después andá a **Deployments**, tocá los tres puntos del último deploy y elegí **Redeploy**.

> Cada vez que cambies una variable tenés que hacer **Redeploy** para que se aplique.

<details>
<summary>¿El botón no te funcionó? Instalación manual</summary>

1. En este repositorio tocá **Use this template → Create a new repository** y dejalo privado.
2. En [vercel.com/new](https://vercel.com/new) importá ese repositorio, cargá las variables de arriba y tocá **Deploy**. El primer deploy falla porque falta la base de datos: es normal.
3. En el proyecto: **Storage → Create Database → Neon** → conectala al proyecto.
4. **Deployments → ⋯ → Redeploy**.

</details>

### Recibir actualizaciones

Tu copia es independiente: las versiones nuevas de este repositorio no te llegan solas. Cuando salga una, se va a avisar en la comunidad cómo traerla. Las tablas se actualizan solas en el deploy.

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
