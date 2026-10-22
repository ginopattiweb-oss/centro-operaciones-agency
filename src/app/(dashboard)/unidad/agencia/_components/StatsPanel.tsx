import { BarChart3 } from "lucide-react";
import {
  getStatsSummary,
  type StatsRange,
  type StatsSummary,
} from "@/lib/analytics";
import {
  deltaPercent,
  formatDuration,
  formatNumber,
  formatPercent,
  type DailyPoint,
} from "@/lib/analytics-format";
import { formatShortDateStr } from "@/lib/date";
import { Delta, Notice } from "./ui";
import { Sparkline } from "./Sparkline";
import { SeriesChart } from "./SeriesChart";

/**
 * KPIs, serie temporal y comparación de la web propia.
 * Una sola llamada a GA4 (`getStatsSummary`) alimenta todo el bloque: las tiles,
 * los sparklines y el gráfico grande salen de la misma respuesta.
 */

type Kpi = {
  key: keyof StatsSummary;
  label: string;
  format: (value: number) => string;
  /** true cuando bajar es bueno (rebote). */
  inverted?: boolean;
};

// Exactamente las métricas que pide `runReport` hoy, en el mismo orden.
const KPIS: Kpi[] = [
  { key: "users", label: "Usuarios", format: formatNumber },
  { key: "sessions", label: "Sesiones", format: formatNumber },
  { key: "pageViews", label: "Vistas de página", format: formatNumber },
  { key: "bounceRate", label: "Rebote", format: formatPercent, inverted: true },
  { key: "avgSessionDuration", label: "Duración media", format: formatDuration },
];

export async function StatsPanel({
  propertyId,
  range,
}: {
  propertyId: string;
  range: StatsRange;
}) {
  const stats = await getStatsSummary(propertyId, range);

  if (!stats.ok) {
    return (
      <Notice>
        No pudimos traer las estadísticas:{" "}
        <span className="text-[var(--sp-ink)]">{stats.error}</span>
      </Notice>
    );
  }

  const { current, previous, series, from, to } = stats;
  const hasData = series.some(
    (point) => point.users > 0 || point.sessions > 0 || point.pageViews > 0
  );

  if (!hasData) {
    return (
      <div className="sp-card flex flex-col items-center gap-3 px-6 py-14 text-center">
        <BarChart3 className="h-6 w-6 text-[var(--sp-muted)]" />
        <p className="sp-display text-lg">Sin datos en este rango</p>
        <p className="text-sm text-[var(--sp-muted)]">
          Google Analytics no registró tráfico entre el {formatShortDateStr(from)} y el{" "}
          {formatShortDateStr(to)}.
        </p>
      </div>
    );
  }

  // GA devuelve el período anterior en la misma tanda: si vino todo en cero no
  // hay base contra la cual comparar y las tiles lo dicen en lugar de inventar 0%.
  const comparable = KPIS.some((kpi) => previous[kpi.key] > 0);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-1 gap-px bg-[var(--sp-line)] sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {KPIS.map((kpi) => (
          <KpiTile
            key={kpi.key}
            kpi={kpi}
            value={current[kpi.key]}
            delta={deltaPercent(current[kpi.key], previous[kpi.key])}
            series={series}
          />
        ))}
      </div>

      <SeriesChart series={series} />

      <p className="text-xs text-[var(--sp-muted)]">
        Del {formatShortDateStr(from)} al {formatShortDateStr(to)}
        {comparable ? ", comparado con el período anterior." : " · sin comparación."}
      </p>
    </div>
  );
}

function KpiTile({
  kpi,
  value,
  delta,
  series,
}: {
  kpi: Kpi;
  value: number;
  delta: number | null;
  series: DailyPoint[];
}) {
  return (
    <div className="flex flex-col gap-4 bg-[var(--sp-surface)] p-5 md:p-6">
      <p className="sp-display text-[11px] text-[var(--sp-muted)]">{kpi.label}</p>
      <p className="sp-display text-[2.25rem] leading-none tabular-nums text-[var(--sp-ink)]">
        {kpi.format(value)}
      </p>
      <Delta value={delta} inverted={kpi.inverted} />
      <Sparkline values={series.map((point) => point[kpi.key])} />
    </div>
  );
}
