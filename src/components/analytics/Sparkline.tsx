/**
 * Sparkline de la stat tile: sin ejes, sin etiquetas, sin hover.
 * El valor exacto lo dan el número de la tile y el gráfico grande.
 */

export function Sparkline({
  values,
  height = 28,
}: {
  values: number[];
  height?: number;
}) {
  if (values.length < 2) return <div style={{ height }} />;

  const width = 100; // viewBox relativo; el ancho real lo pone el contenedor
  const max = Math.max(...values);
  const min = Math.min(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);
  // 1.5 de margen arriba y abajo para que el trazo de 2px no se corte en los extremos.
  const y = (value: number) => 1.5 + (1 - (value - min) / span) * (height - 3);

  const points = values.map((value, index) => [index * stepX, y(value)] as const);
  const line = points.map(([px, py], i) => `${i === 0 ? "M" : "L"}${px} ${py}`).join(" ");
  const area = `${line} L${width} ${height} L0 ${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className="mt-2 w-full"
      style={{ height }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="co-spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--data-1)" stopOpacity={0.42} />
          <stop offset="100%" stopColor="var(--data-4)" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="co-spark-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--data-1)" />
          <stop offset="100%" stopColor="var(--data-4)" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#co-spark-fill)" />
      <path
        d={line}
        fill="none"
        stroke="url(#co-spark-line)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
