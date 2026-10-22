"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Table2, LineChart } from "lucide-react";
import {
  formatDuration,
  formatNumber,
  formatPercent,
  type DailyPoint,
} from "@/lib/analytics-format";
import { formatShortDateStr } from "@/lib/date";

type MetricKey = "users" | "sessions" | "pageViews";

const METRIC_OPTIONS: { key: MetricKey; label: string }[] = [
  { key: "users", label: "Usuarios" },
  { key: "sessions", label: "Sesiones" },
  { key: "pageViews", label: "Vistas" },
];

const HEIGHT = 300;
const PAD = { top: 16, right: 16, bottom: 28, left: 48 };

/**
 * Techo y marcas del eje Y. Las tres métricas son conteos, así que el paso se
 * restringe a enteros: un tick en 2,5 etiquetado "3" mentiría sobre dónde está
 * la línea. El paso se redondea al múltiplo redondo más cercano (1/2/5 × 10ⁿ).
 */
function niceScale(maxValue: number): { max: number; ticks: number[] } {
  if (maxValue <= 4) return { max: 4, ticks: [0, 1, 2, 3, 4] };

  const rawStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const nearest = [1, 2, 5, 10]
    .map((factor) => factor * magnitude)
    .reduce((best, candidate) =>
      Math.abs(candidate - rawStep) < Math.abs(best - rawStep) ? candidate : best
    );

  const step = Math.max(1, Math.round(nearest));
  const max = Math.ceil(maxValue / step) * step;
  return {
    max,
    ticks: Array.from({ length: max / step + 1 }, (_, index) => index * step),
  };
}

/** Serie temporal diaria de GA4: área dorada, toggle de métrica y vista de tabla. */
export function SeriesChart({ series }: { series: DailyPoint[] }) {
  const [metric, setMetric] = useState<MetricKey>("users");
  const [showTable, setShowTable] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(720);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(280, entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const metricLabel = METRIC_OPTIONS.find((option) => option.key === metric)!.label;

  return (
    <div className="sp-card flex flex-col gap-5 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {METRIC_OPTIONS.map((option) => {
            const on = metric === option.key;
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setMetric(option.key)}
                aria-pressed={on}
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
                {option.label}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          className="sp-pill inline-flex items-center gap-1.5 border border-[var(--sp-line-strong)] px-3.5 py-1.5 text-xs font-medium text-[var(--sp-muted)] hover:border-[var(--sp-gold)] hover:text-[var(--sp-amber)]"
        >
          {showTable ? <LineChart className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {showTable ? "Ver gráfico" : "Ver tabla"}
        </button>
      </div>

      {showTable ? (
        <SeriesTable series={series} />
      ) : (
        <div ref={containerRef} className="relative w-full">
          <Plot
            series={series}
            metric={metric}
            metricLabel={metricLabel}
            width={width}
            hover={hover}
            onHover={setHover}
          />
        </div>
      )}
    </div>
  );
}

function Plot({
  series,
  metric,
  metricLabel,
  width,
  hover,
  onHover,
}: {
  series: DailyPoint[];
  metric: MetricKey;
  metricLabel: string;
  width: number;
  hover: number | null;
  onHover: (index: number | null) => void;
}) {
  const gradientId = `sp-area-${useId().replace(/:/g, "")}`;
  const values = series.map((point) => point[metric]);
  const { max, ticks } = niceScale(Math.max(...values, 0));
  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;

  const x = (index: number) =>
    PAD.left + (series.length === 1 ? plotWidth / 2 : (index / (series.length - 1)) * plotWidth);
  const y = (value: number) => PAD.top + (1 - value / max) * plotHeight;

  const line = values.map((value, i) => `${i === 0 ? "M" : "L"}${x(i)} ${y(value)}`).join(" ");
  const area = `${line} L${x(values.length - 1)} ${PAD.top + plotHeight} L${x(0)} ${
    PAD.top + plotHeight
  } Z`;

  const lastIndex = values.length - 1;

  // Sólo primera, media y última fecha: más etiquetas se pisan entre sí.
  const xLabelIndexes = [0, Math.floor(lastIndex / 2), lastIndex].filter(
    (value, index, list) => list.indexOf(value) === index
  );

  function handleMove(event: React.MouseEvent<SVGRectElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = plotWidth === 0 ? 0 : (event.clientX - bounds.left) / plotWidth;
    const index = Math.round(ratio * lastIndex);
    onHover(Math.min(Math.max(index, 0), lastIndex));
  }

  return (
    <>
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={`${metricLabel} por día`}
        className="block"
      >
        <defs>
          {/* Relleno: cae del teal al azul y se apaga hacia abajo. */}
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--data-1)" stopOpacity={0.38} />
            <stop offset="55%" stopColor="var(--data-4)" stopOpacity={0.14} />
            <stop offset="100%" stopColor="var(--data-4)" stopOpacity={0} />
          </linearGradient>
          {/* Línea: mismo recorrido de color, en horizontal. */}
          <linearGradient id={`${gradientId}-line`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--data-1)" />
            <stop offset="100%" stopColor="var(--data-4)" />
          </linearGradient>
        </defs>

        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--sp-line)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              className="fill-[var(--sp-muted)] text-[10px] tabular-nums"
            >
              {formatNumber(tick)}
            </text>
          </g>
        ))}

        {xLabelIndexes.map((index) => (
          <text
            key={index}
            x={x(index)}
            y={HEIGHT - 8}
            textAnchor={index === 0 ? "start" : index === lastIndex ? "end" : "middle"}
            className="fill-[var(--sp-muted)] text-[10px]"
          >
            {formatShortDateStr(series[index].date)}
          </text>
        ))}

        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke={`url(#${gradientId}-line)`}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hover !== null && (
          <>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={PAD.top}
              y2={PAD.top + plotHeight}
              stroke="var(--border-strong)"
              strokeWidth={1}
            />
            <circle
              cx={x(hover)}
              cy={y(values[hover])}
              r={5}
              fill="var(--sp-series)"
              stroke="var(--sp-surface)"
              strokeWidth={2}
            />
          </>
        )}

        {/* Punto final siempre visible: ancla la lectura del último dato. */}
        {hover === null && lastIndex >= 0 && (
          <circle
            cx={x(lastIndex)}
            cy={y(values[lastIndex])}
            r={4}
            fill="var(--sp-series)"
            stroke="var(--sp-surface)"
            strokeWidth={2}
          />
        )}

        {/* Capa de hit invisible: el hover no exige puntería sobre la línea. */}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotWidth}
          height={plotHeight}
          fill="none"
          style={{ pointerEvents: "all" }}
          onMouseMove={handleMove}
          onMouseLeave={() => onHover(null)}
        />
      </svg>

      {hover !== null && (
        <Tooltip
          point={series[hover]}
          left={x(hover)}
          containerWidth={width}
          metric={metric}
        />
      )}
    </>
  );
}

function Tooltip({
  point,
  left,
  containerWidth,
  metric,
}: {
  point: DailyPoint;
  left: number;
  containerWidth: number;
  metric: MetricKey;
}) {
  const WIDTH = 176;
  // Que no se salga por ningún borde del contenedor.
  const clamped = Math.min(Math.max(left - WIDTH / 2, 0), Math.max(containerWidth - WIDTH, 0));

  const rows: { label: string; value: string; highlight: boolean }[] = [
    { label: "Usuarios", value: formatNumber(point.users), highlight: metric === "users" },
    { label: "Sesiones", value: formatNumber(point.sessions), highlight: metric === "sessions" },
    { label: "Vistas", value: formatNumber(point.pageViews), highlight: metric === "pageViews" },
    { label: "Rebote", value: formatPercent(point.bounceRate), highlight: false },
    { label: "Duración", value: formatDuration(point.avgSessionDuration), highlight: false },
  ];

  return (
    <div
      className="sp-card pointer-events-none absolute top-2 z-10 px-3 py-2"
      style={{ left: clamped, width: WIDTH }}
    >
      <p className="mb-1.5 text-[11px] text-[var(--sp-muted)]">
        {formatShortDateStr(point.date)}
      </p>
      <dl className="flex flex-col gap-0.5">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3">
            <dt className="flex items-center gap-1.5 text-[11px] text-[var(--sp-muted)]">
              {row.highlight && (
                <span className="sp-pill h-1.5 w-1.5" style={{ background: "var(--sp-series)" }} />
              )}
              {row.label}
            </dt>
            <dd
              className={`text-[11px] tabular-nums ${
                row.highlight ? "text-[var(--sp-ink)]" : "text-[var(--sp-muted)]"
              }`}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function SeriesTable({ series }: { series: DailyPoint[] }) {
  return (
    <div className="rounded-co-control max-h-[300px] overflow-auto border border-[var(--sp-line)]">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-[var(--sp-surface)]">
          <tr className="sp-display text-[11px] text-[var(--sp-muted)]">
            <th className="px-4 py-2.5 font-medium">Día</th>
            <th className="px-4 py-2.5 text-right font-medium">Usuarios</th>
            <th className="px-4 py-2.5 text-right font-medium">Sesiones</th>
            <th className="px-4 py-2.5 text-right font-medium">Vistas</th>
            <th className="px-4 py-2.5 text-right font-medium">Rebote</th>
            <th className="px-4 py-2.5 text-right font-medium">Duración</th>
          </tr>
        </thead>
        <tbody>
          {series.map((point) => (
            <tr key={point.date} className="border-t border-[var(--sp-line)]">
              <td className="px-4 py-2 text-[var(--sp-muted)]">
                {formatShortDateStr(point.date)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums">{formatNumber(point.users)}</td>
              <td className="px-4 py-2 text-right tabular-nums">{formatNumber(point.sessions)}</td>
              <td className="px-4 py-2 text-right tabular-nums">
                {formatNumber(point.pageViews)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-[var(--sp-muted)]">
                {formatPercent(point.bounceRate)}
              </td>
              <td className="px-4 py-2 text-right tabular-nums text-[var(--sp-muted)]">
                {formatDuration(point.avgSessionDuration)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
