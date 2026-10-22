import { TokenTable } from "./_components/TokenTable";

const SURFACES = [
  { name: "--bg-base", use: "Fondo de app" },
  { name: "--bg-surface", use: "Tarjetas" },
  { name: "--bg-surface-2", use: "Tarjetas anidadas, tooltips, inputs" },
  { name: "--bg-hover", use: "Hover de fila, tab activo" },
];

const BORDERS = [
  { name: "--border-subtle", use: "Default de toda tarjeta" },
  { name: "--border-strong", use: "Hover, foco, elemento activo" },
];

const TEXT = [
  { name: "--text-primary", use: "Números, títulos" },
  { name: "--text-secondary", use: "Body, descripciones, delta" },
  { name: "--text-tertiary", use: "Micro-labels, ejes de gráficos" },
];

const BRAND = [
  { name: "--accent", use: "Chip activo, foco, botón primario. Neutro: sin color de marca" },
  { name: "--accent-soft", use: "Fondo de chip activo" },
];

const DATA = [
  { name: "--data-1", use: "Serie primaria (teal)" },
  { name: "--data-2", use: "Serie secundaria — sólo dentro de gráficos" },
  { name: "--data-3", use: "Serie terciaria — sólo dentro de gráficos" },
  { name: "--data-4", use: "Serie cuaternaria — sólo dentro de gráficos" },
];

const SEMANTIC = [
  { name: "--positive", use: "Delta positivo, siempre con flecha y signo" },
  { name: "--warning", use: "Pendiente, por vencer, proyecto en alerta" },
  { name: "--negative", use: "Delta negativo, siempre con flecha y signo" },
  { name: "--neutral", use: "Sin variación / dato ausente" },
];

const RADII = [
  { token: "--radius-card", clase: "rounded-co-card", uso: "Tarjetas" },
  {
    token: "--radius-control",
    clase: "rounded-co-control",
    uso: "Inputs, botones cuadrados, thumbnails",
  },
  {
    token: "--radius-pill",
    clase: "rounded-co-pill",
    uso: "Chips, tabs, badges, barras de progreso",
  },
];

const SPACING = [
  { valor: "24px", uso: "Padding interno de tarjeta (desktop)" },
  { valor: "20px", uso: "Padding interno de tarjeta (mobile)" },
  { valor: "16px", uso: "Gap del grid de tarjetas" },
  { valor: "8pt", uso: "Grilla base de todo el espaciado" },
];

function Section({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="co-title-card text-[20px]">{title}</h2>
        {note ? <p className="co-body max-w-2xl">{note}</p> : null}
      </div>
      <div className="rounded-co-card border border-co-subtle bg-co-surface p-5 md:p-6">
        {children}
      </div>
    </section>
  );
}

export default function DesignSystemPage() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-10 md:px-8 md:py-14">
      <header className="mb-12 space-y-2">
        <p className="co-microlabel">Bloque 1 — tokens y base</p>
        <h1 className="co-title-section">Sistema de diseño</h1>
        <p className="co-body max-w-2xl">
          Paleta, tipografía y geometría del panel oscuro. Los valores de esta
          página se leen de las variables CSS reales en el navegador: si cambia{" "}
          <code className="font-mono text-co-primary">globals.css</code>, cambia
          acá. En Tailwind los tokens se consumen con prefijo{" "}
          <code className="font-mono text-co-primary">co-</code> (
          <code className="font-mono text-co-primary">bg-co-surface</code>,{" "}
          <code className="font-mono text-co-primary">text-co-tertiary</code>,{" "}
          <code className="font-mono text-co-primary">rounded-co-card</code>)
          porque el sistema claro anterior sigue en pie en el portal de clientes.
        </p>
      </header>

      <div className="space-y-12">
        <Section title="Superficies">
          <TokenTable tokens={SURFACES} />
        </Section>

        <Section
          title="Bordes"
          note="La elevación se resuelve con contraste de superficie más hairline de 1px. No hay sombras en ningún elemento de UI."
        >
          <TokenTable tokens={BORDERS} />
        </Section>

        <Section
          title="Texto"
          note="Contraste WCAG 2.1 calculado sobre cada superficie. Mínimo exigido: 4.5:1 en cuerpo, 3:1 en labels de 11px."
        >
          <TokenTable
            tokens={TEXT}
            contrastAgainst={["--bg-base", "--bg-surface", "--bg-surface-2"]}
          />
        </Section>

        <Section
          title="Marca"
          note="El acento es neutro. Se usa para chip o tab activo, foco de teclado y botón primario. Todo el color queda para datos."
        >
          <TokenTable tokens={BRAND} contrastAgainst={["--bg-base", "--bg-surface"]} />
        </Section>

        <Section
          title="Series de datos"
          note="Teal, violeta, rosa y azul son colores de datos: nunca bordes, textos ni fondos de interfaz."
        >
          <TokenTable tokens={DATA} />
        </Section>

        <Section
          title="Semántica"
          note="Positivo y negativo van siempre acompañados de flecha y signo. Nunca sólo color."
        >
          <div className="space-y-6">
            <TokenTable tokens={SEMANTIC} contrastAgainst={["--bg-surface"]} />
            <div className="flex flex-wrap items-center gap-6">
              <span className="co-delta tabular-nums text-co-positive">
                ↗ +21.4%
              </span>
              <span className="co-delta tabular-nums text-co-negative">
                ↘ −8.2%
              </span>
              <span className="co-delta tabular-nums text-co-neutral">
                Sin variación
              </span>
            </div>
          </div>
        </Section>

        <Section
          title="Gradientes"
          note="Único lugar permitido: gráficos y barras de progreso. Nunca en botones, fondos ni tarjetas."
        >
          <div className="space-y-5">
            {[
              { token: "--grad-series", uso: "Serie principal: teal → azul" },
              { token: "--grad-cool", uso: "Serie secundaria: violeta → rosa" },
              { token: "--grad-ramp", uso: "Escala de desempeño: verde → naranja → rojo" },
              { token: "--grad-positive", uso: "Barra completa" },
            ].map((grad) => (
              <div key={grad.token} className="space-y-2">
                <div
                  className="h-3 w-full rounded-co-pill"
                  style={{ background: `var(${grad.token})` }}
                />
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-mono text-[12px] text-co-primary">{grad.token}</p>
                  <p className="co-delta">{grad.uso}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Barras"
          note="Track de 6px al 6% de blanco, fill con gradiente, todo en radio pill. Clases: co-track, co-fill, co-fill-ramp, co-fill-positive."
        >
          <div className="space-y-5">
            {[
              { label: "co-fill", width: "62%", extra: "" },
              { label: "co-fill co-fill-ramp", width: "84%", extra: " co-fill-ramp" },
              { label: "co-fill co-fill-positive", width: "100%", extra: " co-fill-positive" },
            ].map((bar) => (
              <div key={bar.label} className="space-y-2">
                <div className="co-track">
                  <div className={`co-fill${bar.extra}`} style={{ width: bar.width }} />
                </div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="font-mono text-[12px] text-co-secondary">{bar.label}</p>
                  <p className="co-delta tabular-nums">{bar.width}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          title="Vidrio"
          note="Sólo para capas que flotan: diálogos, drawers, sidebar y barras fijas. Las tarjetas del panel siguen opacas — a esta densidad de números el blur cuesta legibilidad."
        >
          <div className="relative overflow-hidden rounded-co-card">
            {/* Fondo con color para que el blur se note. */}
            <div
              className="h-44 w-full"
              style={{
                background:
                  "radial-gradient(120% 120% at 20% 20%, var(--data-1) 0%, transparent 55%), radial-gradient(120% 120% at 80% 60%, var(--data-2) 0%, transparent 50%)",
                opacity: 0.55,
              }}
            />
            <div className="co-glass absolute left-6 top-6 rounded-co-card p-5">
              <p className="co-microlabel">Capa flotante</p>
              <p className="co-metric-sm mt-1 tabular-nums">co-glass</p>
              <p className="co-delta mt-1">blur 18px · saturate 140%</p>
            </div>
          </div>
        </Section>

        <Section
          title="Tipografía"
          note="Geist para display y números, Poppins para cuerpo. Todo número comparable lleva tabular-nums."
        >
          <div className="space-y-8">
            <TypeRow
              spec="Geist 32-40 / 600 / -0.02em"
              label="Título de sección"
            >
              <p className="co-title-section">Rendimiento de visitas</p>
            </TypeRow>
            <TypeRow spec="Geist 15 / 500" label="Título de tarjeta">
              <p className="co-title-card">Leads por origen</p>
            </TypeRow>
            <TypeRow
              spec="Poppins 11 / 500 / uppercase / 0.08em"
              label="Micro-label"
            >
              <p className="co-microlabel">Rendimiento de visitas</p>
            </TypeRow>
            <TypeRow
              spec="Geist 40-56 / 600 / -0.03em / tabular-nums"
              label="Número métrico"
            >
              <p className="co-metric tabular-nums">
                1.4M{" "}
                <span className="co-body align-middle text-co-tertiary">
                  impresiones
                </span>
              </p>
            </TypeRow>
            <TypeRow
              spec="Geist 20-24 / 500 / tabular-nums"
              label="Número secundario"
            >
              <p className="co-metric-sm tabular-nums">29.3K</p>
            </TypeRow>
            <TypeRow spec="Poppins 13-14 / 1.5" label="Body">
              <p className="co-body max-w-xl">
                Cada número renderizado tiene una fuente verificable en la base o
                en la API correspondiente. Si el dato no existe, la tarjeta no se
                dibuja.
              </p>
            </TypeRow>
            <TypeRow spec="Poppins 12 / tabular-nums" label="Delta / contexto">
              <p className="co-delta tabular-nums">
                Promedio 90d 1.99% · 30% más alto
              </p>
            </TypeRow>
          </div>
        </Section>

        <Section
          title="Radios"
          note="El radio vive en un solo token por familia. Poner --radius-card en 0px devuelve el sistema entero a flat sin tocar componentes."
        >
          <div className="grid gap-4 sm:grid-cols-3">
            {RADII.map((radio) => (
              <div key={radio.token} className="space-y-3">
                <div
                  className="rounded-co-control h-20 border border-co-strong bg-co-surface-2"
                  style={{ borderRadius: `var(${radio.token})` }}
                />
                <div className="space-y-1">
                  <p className="font-mono text-[12px] text-co-primary">
                    {radio.token}
                  </p>
                  <p className="font-mono text-[12px] text-co-secondary">
                    {radio.clase}
                  </p>
                  <p className="co-delta">{radio.uso}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Espaciado" note="Grilla de 8pt, sin excepciones.">
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {SPACING.map((item) => (
              <div
                key={item.valor}
                className="flex items-baseline justify-between gap-4 border-b border-co-subtle pb-3"
              >
                <dt className="co-body text-co-primary">{item.uso}</dt>
                <dd className="font-mono text-[13px] tabular-nums text-co-secondary">
                  {item.valor}
                </dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section
          title="Foco de teclado"
          note="Outline de 2px en el acento con offset de 2px, en todo elemento interactivo. Tabulá hasta el botón para verlo."
        >
          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="rounded-co-pill bg-co-accent px-4 py-2 text-[13px] font-medium text-co-base"
            >
              Botón primario
            </button>
            <button
              type="button"
              className="rounded-co-pill border border-co-subtle px-4 py-2 text-[13px] text-co-secondary transition-colors hover:border-co-strong hover:text-co-primary"
            >
              Botón secundario
            </button>
            <button
              type="button"
              className="rounded-co-pill bg-co-accent-soft px-4 py-2 text-[13px] font-medium text-co-accent"
            >
              Chip activo
            </button>
          </div>
        </Section>
      </div>
    </div>
  );
}

function TypeRow({
  label,
  spec,
  children,
}: {
  label: string;
  spec: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b border-co-subtle pb-6 last:border-b-0 last:pb-0 md:grid-cols-[200px_1fr] md:gap-8">
      <div>
        <p className="co-title-card">{label}</p>
        <p className="co-delta font-mono text-[11px] text-co-tertiary">{spec}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
