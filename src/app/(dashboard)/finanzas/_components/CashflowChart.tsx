"use client";

/**
 * Evolución del flujo de caja. Por cada mes: dos barras (estimado y cobrado) y
 * una línea de gastos encima. La comparación estimado/cobrado es la que dice si
 * vamos adelantados o atrasados; los gastos marcan a partir de dónde queda neto.
 */
import { useEffect, useRef, useState } from "react";
import { formatMoney, type Currency } from "@/lib/finanzas";
import {
  completionRatio,
  formatMoneyShort,
  formatMonthLong,
  formatMonthShort,
  type MonthTotals,
} from "@/lib/presupuesto";

const HEIGHT = 260;
const PAD = { top: 16, right: 12, bottom: 30, left: 56 };

/** Techo y marcas del eje. Paso redondo (1/2/5 × 10ⁿ) para que las etiquetas se lean. */
function niceScale(maxValue: number): { max: number; ticks: number[] } {
  if (maxValue <= 0) return { max: 100_00, ticks: [0, 50_00, 100_00] };

  const rawStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const step = [1, 2, 5, 10]
    .map((factor) => factor * magnitude)
    .reduce((best, candidate) =>
      Math.abs(candidate - rawStep) < Math.abs(best - rawStep) ? candidate : best
    );

  const max = Math.ceil(maxValue / step) * step;
  return {
    max,
    ticks: Array.from({ length: Math.round(max / step) + 1 }, (_, index) => index * step),
  };
}

export function CashflowChart({
  totals,
  currency,
  selectedMonth,
  currentMonth,
  onSelectMonth,
}: {
  totals: MonthTotals[];
  currency: Currency;
  selectedMonth: string;
  currentMonth: string;
  onSelectMonth: (month: string) => void;
}) {
  const [width, setWidth] = useState(720);
  const [hover, setHover] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(320, entry.contentRect.width));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const peak = Math.max(
    ...totals.flatMap((row) => [row.estimatedCents, row.receivedCents, row.expensesCents]),
    0
  );
  const { max, ticks } = niceScale(peak);

  const plotWidth = width - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const slot = totals.length > 0 ? plotWidth / totals.length : plotWidth;
  const barWidth = Math.max(3, Math.min(18, (slot - 6) / 2));

  const y = (cents: number) => PAD.top + (1 - Math.min(cents, max) / max) * plotHeight;
  const slotCenter = (index: number) => PAD.left + slot * index + slot / 2;

  const expensePath = totals
    .map((row, index) => `${index === 0 ? "M" : "L"}${slotCenter(index)} ${y(row.expensesCents)}`)
    .join(" ");

  // Con muchos meses las etiquetas se pisan: se saltean cada n.
  const labelEvery = Math.ceil(totals.length / Math.max(4, Math.floor(plotWidth / 52)));
  const active = hover;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-4">
        <Legend color="var(--color-series-2)" label="Estimado" />
        <Legend color="var(--color-series)" label="Cobrado" />
        <Legend color="var(--color-negative)" label="Gastos" line />
      </div>

      <div ref={containerRef} className="relative w-full">
        <svg width={width} height={HEIGHT} role="img" aria-label="Flujo de caja por mes">
        <defs>
          {/* Barras: el color de cada serie se apaga hacia la base. */}
          <linearGradient id="co-cash-received" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--data-1)" />
            <stop offset="100%" stopColor="var(--data-1)" stopOpacity={0.45} />
          </linearGradient>
          <linearGradient id="co-cash-estimated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--data-2)" stopOpacity={0.75} />
            <stop offset="100%" stopColor="var(--data-2)" stopOpacity={0.25} />
          </linearGradient>
        </defs>
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--color-border)"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={y(tick) + 4}
                textAnchor="end"
                className="fill-[var(--color-fg-muted)] text-[10px] tabular-nums"
              >
                {formatMoneyShort(tick, currency)}
              </text>
            </g>
          ))}

          {totals.map((row, index) => {
            const isSelected = row.month === selectedMonth;
            const isCurrent = row.month === currentMonth;
            const center = slotCenter(index);
            const base = PAD.top + plotHeight;

            return (
              <g key={row.month}>
                {(isSelected || isCurrent) && (
                  <rect
                    x={PAD.left + slot * index}
                    y={PAD.top}
                    width={slot}
                    height={plotHeight}
                    fill={isSelected ? "var(--color-accent)" : "var(--color-fg-muted)"}
                    opacity={isSelected ? 0.12 : 0.05}
                  />
                )}

                <rect
                  x={center - barWidth - 1}
                  y={y(row.estimatedCents)}
                  width={barWidth}
                  height={Math.max(0, base - y(row.estimatedCents))}
                  fill="url(#co-cash-estimated)"
                />
                <rect
                  x={center + 1}
                  y={y(row.receivedCents)}
                  width={barWidth}
                  height={Math.max(0, base - y(row.receivedCents))}
                  fill="url(#co-cash-received)"
                />

                {index % labelEvery === 0 && (
                  <text
                    x={center}
                    y={HEIGHT - 10}
                    textAnchor="middle"
                    className={`text-[10px] ${
                      isSelected
                        ? "fill-[var(--color-fg)]"
                        : "fill-[var(--color-fg-muted)]"
                    }`}
                  >
                    {formatMonthShort(row.month)}
                  </text>
                )}
              </g>
            );
          })}

          <path
            d={expensePath}
            fill="none"
            stroke="var(--color-negative)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={0.85}
          />

          {/* Capa de hit por mes: seleccionar no exige puntería sobre la barra. */}
          {totals.map((row, index) => (
            <rect
              key={`hit-${row.month}`}
              x={PAD.left + slot * index}
              y={PAD.top}
              width={slot}
              height={plotHeight}
              fill="transparent"
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHover(index)}
              onMouseLeave={() => setHover(null)}
              onClick={() => onSelectMonth(row.month)}
            >
              <title>{formatMonthLong(row.month)}</title>
            </rect>
          ))}
        </svg>

        {active !== null && (
          <Tooltip
            row={totals[active]}
            currency={currency}
            left={slotCenter(active)}
            containerWidth={width}
          />
        )}
      </div>
    </div>
  );
}

function Legend({ color, label, line = false }: { color: string; label: string; line?: boolean }) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-fg-muted">
      <span
        className="inline-block"
        style={{
          background: color,
          width: line ? 14 : 10,
          height: line ? 2 : 10,
          borderRadius: line ? 2 : 2,
          opacity: label === "Estimado" ? 0.55 : 1,
        }}
      />
      {label}
    </span>
  );
}

function Tooltip({
  row,
  currency,
  left,
  containerWidth,
}: {
  row: MonthTotals;
  currency: Currency;
  left: number;
  containerWidth: number;
}) {
  const WIDTH = 210;
  const clamped = Math.min(Math.max(left - WIDTH / 2, 0), Math.max(containerWidth - WIDTH, 0));
  const ratio = completionRatio(row);

  const rows = [
    { label: "Estimado", value: formatMoney(row.estimatedCents, currency) },
    { label: "Cobrado", value: formatMoney(row.receivedCents, currency) },
    { label: "Gastos", value: formatMoney(row.expensesCents, currency) },
    { label: "Neto", value: formatMoney(row.netCents, currency) },
  ];

  return (
    <div
      className="pointer-events-none absolute top-2 z-10 rounded-lg border border-border bg-surface px-3 py-2 shadow-lg"
      style={{ left: clamped, width: WIDTH }}
    >
      <p className="mb-1.5 text-[11px] capitalize text-fg-muted">{formatMonthLong(row.month)}</p>
      <dl className="flex flex-col gap-0.5">
        {rows.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-3">
            <dt className="text-[11px] text-fg-muted">{item.label}</dt>
            <dd className="text-[11px] tabular-nums text-fg">{item.value}</dd>
          </div>
        ))}
      </dl>
      {ratio !== null && (
        <p className="mt-1.5 border-t border-border pt-1.5 text-[11px] text-fg-muted">
          Cumplimiento: <span className="text-fg tabular-nums">{Math.round(ratio * 100)}%</span>
        </p>
      )}
    </div>
  );
}
