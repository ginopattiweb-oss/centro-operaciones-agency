import { formatCompact } from "@/lib/contenido-config";
import { formatShortDateStr } from "@/lib/date";

const HEIGHT = 180;
const PAD = { top: 8, right: 8, bottom: 22, left: 40 };
const WIDTH = 720;

/** Barras por día. Sin interacción: el número exacto está en la tile. */
export function ViewsChart({
  series,
  label,
  empty = "Sin datos para este rango.",
}: {
  series: { date: string; value: number }[];
  label: string;
  empty?: string;
}) {
  if (series.length === 0) {
    return <p className="px-5 py-10 text-center text-sm text-fg-muted">{empty}</p>;
  }

  const max = Math.max(1, ...series.map((point) => point.value));
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const slot = plotW / series.length;
  const barW = Math.max(2, slot * 0.6);
  const ticks = [0, 0.5, 1].map((ratio) => ratio * max);
  const labelEvery = Math.max(1, Math.ceil(series.length / 7));

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="w-full"
      style={{ height: HEIGHT }}
      preserveAspectRatio="none"
      role="img"
      aria-label={label}
    >
      {ticks.map((tick) => {
        const y = PAD.top + plotH - (tick / max) * plotH;
        return (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={WIDTH - PAD.right}
              y1={y}
              y2={y}
              stroke="var(--border-subtle)"
              strokeDasharray="2 4"
            />
            <text
              x={PAD.left - 6}
              y={y + 3}
              textAnchor="end"
              fontSize={10}
              fill="var(--text-tertiary)"
            >
              {formatCompact(tick)}
            </text>
          </g>
        );
      })}
      {series.map((point, index) => {
        const h = (point.value / max) * plotH;
        const x = PAD.left + index * slot + (slot - barW) / 2;
        return (
          <g key={point.date}>
            <rect
              x={x}
              y={PAD.top + plotH - h}
              width={barW}
              height={h}
              rx={2}
              fill="var(--data-1)"
              opacity={0.85}
            />
            {index % labelEvery === 0 && (
              <text
                x={x + barW / 2}
                y={HEIGHT - 6}
                textAnchor="middle"
                fontSize={10}
                fill="var(--text-tertiary)"
              >
                {formatShortDateStr(point.date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
