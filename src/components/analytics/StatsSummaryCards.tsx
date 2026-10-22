import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  deltaPercent,
  formatDuration,
  formatNumber,
  formatPercent,
  type DailyPoint,
  type StatsSummary,
} from "@/lib/analytics-format";
import { Sparkline } from "./Sparkline";

type Metric = {
  key: keyof StatsSummary;
  label: string;
  format: (value: number) => string;
  /** true cuando bajar es bueno (rebote). */
  inverted?: boolean;
};

const METRICS: Metric[] = [
  { key: "users", label: "Usuarios", format: formatNumber },
  { key: "sessions", label: "Sesiones", format: formatNumber },
  { key: "pageViews", label: "Vistas de página", format: formatNumber },
  { key: "bounceRate", label: "Rebote", format: formatPercent, inverted: true },
  { key: "avgSessionDuration", label: "Duración media", format: formatDuration },
];

export function StatsSummaryCards({
  current,
  previous,
  series,
  compact = false,
}: {
  current: StatsSummary;
  previous: StatsSummary;
  /** Sin serie, las tiles quedan sin sparkline (vista compacta del listado de clientes). */
  series?: DailyPoint[];
  compact?: boolean;
}) {
  return (
    <div
      className={`grid gap-3 ${
        compact ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
      }`}
    >
      {METRICS.map((metric) => {
        const value = current[metric.key];
        const delta = deltaPercent(value, previous[metric.key]);
        return (
          <div
            key={metric.key}
            className="rounded-card border border-border bg-surface px-4 py-3"
          >
            <p className="text-xs uppercase tracking-wider text-fg-muted">{metric.label}</p>
            <p
              className={`mt-2 font-heading text-fg ${compact ? "text-xl" : "text-2xl"}`}
            >
              {metric.format(value)}
            </p>
            <Delta value={delta} inverted={metric.inverted} />
            {series && series.length > 1 && (
              <Sparkline values={series.map((point) => point[metric.key])} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Delta({ value, inverted }: { value: number | null; inverted?: boolean }) {
  if (value === null) {
    return <p className="mt-1.5 text-xs text-fg-muted">sin comparación</p>;
  }

  const flat = Math.abs(value) < 0.005;
  const good = inverted ? value < 0 : value > 0;
  const Icon = flat ? Minus : value > 0 ? TrendingUp : TrendingDown;
  const color = flat ? "text-fg-muted" : good ? "text-positive" : "text-negative";

  return (
    <p className={`mt-1.5 flex items-center gap-1 text-xs ${color}`}>
      <Icon className="h-3 w-3" />
      {flat ? "sin cambios" : `${value > 0 ? "+" : ""}${(value * 100).toFixed(1)}%`}
    </p>
  );
}

export function StatsError({ message }: { message: string }) {
  return (
    <div className="rounded-card border border-border bg-surface px-5 py-4">
      <p className="text-sm text-fg-muted">
        No pudimos traer las estadísticas: <span className="text-fg">{message}</span>
      </p>
    </div>
  );
}

export function RangeTabs({
  basePath,
  active,
}: {
  basePath: string;
  active: string;
}) {
  return (
    <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
      {[
        { value: "7d", label: "7 días" },
        { value: "28d", label: "28 días" },
        { value: "90d", label: "90 días" },
      ].map((range) => (
        <a
          key={range.value}
          href={`${basePath}?rango=${range.value}`}
          className={`rounded-md px-3 py-1.5 text-xs transition ${
            active === range.value
              ? "bg-accent/15 text-accent-ink"
              : "text-fg-muted hover:text-fg"
          }`}
        >
          {range.label}
        </a>
      ))}
    </div>
  );
}
