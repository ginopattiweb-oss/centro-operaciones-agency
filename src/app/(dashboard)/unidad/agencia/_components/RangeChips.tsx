import Link from "next/link";
import { STATS_RANGES, type StatsRange } from "@/lib/analytics-format";

/**
 * Selector de rango (7/28/90 días). Es el mismo `?rango=` que ya lee la página:
 * navegación server-side, sin estado de cliente.
 */
export function RangeChips({
  basePath,
  active,
  /** Parámetros que hay que conservar al cambiar de rango (ej: la pestaña abierta). */
  keep,
}: {
  basePath: string;
  active: StatsRange;
  keep?: Record<string, string>;
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {STATS_RANGES.map((range) => {
        const on = range.value === active;
        const query = new URLSearchParams({ ...keep, rango: range.value });
        return (
          <Link
            key={range.value}
            href={`${basePath}?${query.toString()}`}
            aria-current={on ? "true" : undefined}
            className="sp-pill inline-flex items-center border px-3.5 py-1.5 text-xs font-medium"
            style={
              on
                ? {
                    background: "var(--sp-chip-active)",
                    borderColor: "var(--sp-line-strong)",
                    color: "var(--sp-ink)",
                  }
                : {
                    background: "transparent",
                    borderColor: "var(--sp-line-strong)",
                    color: "var(--sp-muted)",
                  }
            }
          >
            {range.label}
          </Link>
        );
      })}
    </div>
  );
}
