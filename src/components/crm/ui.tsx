/**
 * Primitivas visuales del CRM.
 *
 * Usa los tokens `--sp-*` del scope que activa `PanelTheme`, igual que Contactos
 * y Leads: mismo alto de control, mismo peso de borde, mismos pills. No hay
 * estilos nuevos acá, sólo composición de los que ya existen.
 */
import { chipDerivacion, UNIDADES, type UnidadClave } from "@/lib/crm/unidades";
import type { DerivacionView } from "@/lib/crm/contactos";

/** Campo de formulario: mismo alto y tono que Contactos, Leads y Proyectos. */
export const CRM_INPUT =
  "rounded-co-control w-full border border-[var(--sp-line-strong)] bg-[var(--sp-bone)] px-3 py-2 text-sm text-[var(--sp-ink)]";

/**
 * Color de cada unidad. Es lo ÚNICO que distingue las unidades de un vistazo en
 * la columna Unidades, así que cada una tiene su tinte y no se repiten. Se usan
 * las series de datos del sistema, que es donde el color vive.
 */
const COLOR_UNIDAD: Record<UnidadClave, string> = {
  agencia: "var(--sp-gold)",
};

/**
 * Chip de una derivación: "Agencia · Cotizado".
 *
 * Un chip por unidad, con el estado adentro. La alternativa —una columna por
 * unidad— no sirve: la cantidad de unidades cambia y la tabla no puede crecer a
 * lo ancho cada vez que se suma una.
 */
export function DerivacionChip({ derivacion }: { derivacion: DerivacionView }) {
  const color = COLOR_UNIDAD[derivacion.unidad];
  return (
    <span
      className="sp-pill inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium whitespace-nowrap"
      style={{
        color: "var(--sp-ink)",
        borderColor: `color-mix(in srgb, ${color} 45%, transparent)`,
        background: `color-mix(in srgb, ${color} 14%, transparent)`,
      }}
      title={UNIDADES[derivacion.unidad].etiqueta}
    >
      <span className="sp-pill h-1.5 w-1.5" style={{ background: color }} />
      {chipDerivacion(derivacion.unidad, derivacion.estado)}
    </span>
  );
}

/**
 * Las unidades de una persona. Sin derivaciones NO se muestra un guion: se dice
 * "Sin derivar", que es un estado real del CRM y la razón de ser de la Bandeja.
 */
export function UnidadesChips({ derivaciones }: { derivaciones: DerivacionView[] }) {
  if (derivaciones.length === 0) {
    return (
      <span className="sp-pill inline-flex items-center border border-dashed border-[var(--sp-line-strong)] px-2.5 py-1 text-xs text-[var(--sp-muted)]">
        Sin derivar
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1.5">
      {derivaciones.map((d) => (
        <DerivacionChip key={d.id} derivacion={d} />
      ))}
    </span>
  );
}

/** Etiqueta de tag. Sin color propio: el color lo tienen las unidades. */
export function TagChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="sp-pill inline-flex items-center border border-[var(--sp-line)] px-2 py-0.5 text-[11px] text-[var(--sp-muted)]">
      {children}
    </span>
  );
}

/**
 * Tarjeta de contador. Un cero real es un dato, no un vacío: si una etapa no
 * tiene a nadie, el cero lo dice.
 */
export function CounterCard({
  label,
  value,
  activo = false,
  onClick,
  titulo,
}: {
  label: string;
  value: number;
  activo?: boolean;
  onClick?: () => void;
  /** Qué hace el click, para quien pasa el mouse o usa lector de pantalla. */
  titulo?: string;
}) {
  const contenido = (
    <>
      <span className="sp-display text-[11px] text-[var(--sp-muted)]">{label}</span>
      <span className="text-2xl tabular-nums text-[var(--sp-ink)]">{value}</span>
    </>
  );

  if (!onClick) {
    return <div className="sp-card flex flex-col gap-1 px-4 py-3">{contenido}</div>;
  }

  // Las tarjetas que filtran son botones y no divs con onClick: tienen que
  // poder usarse con el teclado.
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      title={titulo}
      className={`sp-card flex flex-col gap-1 px-4 py-3 text-left transition ${
        activo ? "border-[var(--sp-gold)]" : "hover:border-[var(--sp-gold)]"
      }`}
    >
      {contenido}
    </button>
  );
}

export function Field({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="sp-display text-[11px] text-[var(--sp-muted)]">{label}</span>
      {children}
      {help && <span className="text-[11px] text-[var(--sp-muted)]">{help}</span>}
    </label>
  );
}

/** Dato de la ficha: etiqueta chica arriba, valor abajo. */
export function Dato({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="sp-display text-[11px] text-[var(--sp-muted)]">{label}</span>
      <span className="text-sm break-words text-[var(--sp-ink)]">{children}</span>
    </div>
  );
}

/** Botón secundario: el de la barra de acciones. */
export const BOTON_SECUNDARIO =
  "sp-pill inline-flex min-h-11 items-center gap-2 border border-[var(--sp-line-strong)] px-4 py-2 text-sm font-medium text-[var(--sp-ink)] hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)] disabled:opacity-40";

/** Botón principal: el que confirma. */
export const BOTON_PRIMARIO =
  "sp-pill inline-flex min-h-11 items-center gap-2 border border-[var(--sp-gold)] bg-[color-mix(in_srgb,var(--sp-gold)_18%,transparent)] px-4 py-2 text-sm font-medium text-[var(--sp-amber)] hover:bg-[color-mix(in_srgb,var(--sp-gold)_28%,transparent)] disabled:opacity-40";
