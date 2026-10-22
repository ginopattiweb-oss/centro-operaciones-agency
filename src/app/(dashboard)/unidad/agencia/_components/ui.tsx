import Link from "next/link";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

/**
 * Primitivas del sistema "Sol de Mayo" que usa el dashboard de la agencia.
 * Radio 0 en superficies; la única curva es el pill (999px). Sin sombras grises.
 */

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="sp-display text-sm text-[var(--sp-muted)]">{children}</h2>
      {action}
    </div>
  );
}

/**
 * Variación contra el período anterior. `value` en null cuando GA no devuelve
 * base de comparación: ahí se dice explícitamente que no hay con qué comparar.
 */
export function Delta({
  value,
  inverted = false,
  size = "sm",
}: {
  value: number | null;
  /** true cuando bajar es bueno (rebote). */
  inverted?: boolean;
  size?: "sm" | "md";
}) {
  const text = size === "md" ? "text-sm" : "text-xs";

  if (value === null) {
    return <span className={`${text} text-[var(--sp-muted)]`}>sin comparación</span>;
  }

  const flat = Math.abs(value) < 0.005;
  const good = inverted ? value < 0 : value > 0;
  const color = flat
    ? "var(--sp-muted)"
    : good
      ? "var(--sp-pos)"
      : "var(--sp-crit)";
  const Icon = flat ? Minus : value > 0 ? ArrowUpRight : ArrowDownRight;
  const icon = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";

  return (
    <span
      className={`inline-flex items-center gap-0.5 font-medium tabular-nums ${text}`}
      style={{ color }}
    >
      <Icon className={icon} />
      {flat ? "sin cambios" : `${Math.abs(value * 100).toFixed(1)}%`}
    </span>
  );
}

export function GhostLink({
  href,
  children,
  className = "",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`sp-pill inline-flex min-h-11 items-center justify-center gap-2 border border-[var(--sp-line-strong)] px-4 py-2 text-sm font-medium text-[var(--sp-ink)] hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)] ${className}`}
    >
      {children}
    </Link>
  );
}

export function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="sp-card px-5 py-4 text-sm text-[var(--sp-muted)]">{children}</div>
  );
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

/** Avatar cuadrado (radio 0), con las iniciales de la persona. */
/** Color estable por nombre: mismo nombre, mismo color de la paleta de datos. */
function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) % 997;
  return `var(--data-${(hash % 4) + 1})`;
}

export function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  const tone = avatarColor(name);
  return (
    <span
      title={name}
      className="sp-display inline-flex flex-shrink-0 items-center justify-center border font-medium"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        borderColor: `color-mix(in srgb, ${tone} 34%, transparent)`,
        background: `color-mix(in srgb, ${tone} 14%, var(--sp-surface))`,
        color: tone,
      }}
    >
      {initials(name)}
    </span>
  );
}

export function AvatarStack({ names, size = 26 }: { names: string[]; size?: number }) {
  if (names.length === 0) {
    return <span className="text-xs text-[var(--sp-muted)]">Sin equipo asignado</span>;
  }
  return (
    <div className="flex items-center">
      {names.map((name, index) => (
        <span key={name} style={{ marginLeft: index === 0 ? 0 : -size * 0.28 }}>
          <Avatar name={name} size={size} />
        </span>
      ))}
    </div>
  );
}

/** Chip pill de estado. El color lo decide `statusColor` del estado real. */
export function StatusChip({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="sp-pill inline-flex items-center gap-1.5 border px-2.5 py-1 text-xs font-medium"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 34%, transparent)`,
        background: `color-mix(in srgb, ${color} 10%, transparent)`,
      }}
    >
      <span className="sp-pill h-1.5 w-1.5" style={{ background: color }} />
      {label}
    </span>
  );
}

/**
 * Barra de progreso. `value` en null cuando el proyecto todavía no tiene hitos
 * ni tareas: no se dibuja una barra en cero que aparente avance medido.
 */
export function ProgressBar({ value, detail }: { value: number | null; detail?: string }) {
  if (value === null) {
    return (
      <p className="text-xs text-[var(--sp-muted)]">Sin hitos ni tareas para medir avance</p>
    );
  }
  // Completo va en verde; el resto usa el gradiente de serie (teal → azul).
  const fill = value >= 100 ? "co-fill co-fill-positive" : "co-fill";
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <div className="co-track flex-1">
          <div className={fill} style={{ width: `${Math.min(100, value)}%` }} />
        </div>
        <span className="w-9 text-right text-xs font-medium tabular-nums text-[var(--sp-muted)]">
          {value}%
        </span>
      </div>
      {detail && <p className="text-[11px] text-[var(--sp-muted)]">{detail}</p>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  detail,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  detail?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="sp-card flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon && <div className="text-[var(--sp-muted)]">{icon}</div>}
      <p className="sp-display text-lg">{title}</p>
      {detail && <p className="max-w-md text-sm text-[var(--sp-muted)]">{detail}</p>}
      {action}
    </div>
  );
}
