"use client";

/**
 * Controles compartidos por todas las filas de tarea del panel. Usan los tokens
 * globales (`border`, `accent`, `fg`), que el scope `.sp` redefine con la paleta
 * "Sol de Mayo": la misma fila queda dorada adentro de la agencia y Tareas, y
 * naranja en el resto del Centro de Operaciones.
 */

/** Cuadrado de 15px con borde de 1.5px. Radio 0: el sistema no curva controles. */
export function Casilla({
  tildada,
  onChange,
  etiqueta,
  className = "",
}: {
  tildada: boolean;
  onChange: (valor: boolean) => void;
  etiqueta: string;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={tildada}
      aria-label={etiqueta}
      onClick={() => onChange(!tildada)}
      className={`flex h-[15px] w-[15px] shrink-0 items-center justify-center border-[1.5px] ${
        tildada ? "border-fg bg-fg" : "border-fg-muted hover:border-fg"
      } ${className}`}
    >
      {tildada && (
        <svg viewBox="0 0 12 12" className="h-[9px] w-[9px] text-bg" aria-hidden="true">
          <path
            d="M1.5 6.2 4.4 9 10.5 2.8"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="square"
          />
        </svg>
      )}
    </button>
  );
}

/**
 * Punto de prioridad alta. Ocupa lugar aunque la prioridad sea normal: así los
 * títulos de toda la lista arrancan en la misma columna.
 */
export function PuntoPrioridad({
  alta,
  className = "",
}: {
  alta: boolean;
  className?: string;
}) {
  return (
    <span className={`flex h-[6px] w-[6px] shrink-0 items-center justify-center ${className}`}>
      {alta && (
        <span
          className="h-[6px] w-[6px] rounded-full bg-accent"
          aria-label="Prioridad alta"
        />
      )}
    </span>
  );
}

/** Chip de unidad de negocio. El pill es la única curva que permite el sistema. */
export function ChipUnidad({ nombre }: { nombre: string }) {
  return (
    <span className="rounded-full border border-border px-2 py-[1px] text-[11px]">{nombre}</span>
  );
}
