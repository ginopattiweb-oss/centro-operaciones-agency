/**
 * Tipos y formateo de analytics, sin nada de servidor.
 * Vive aparte de analytics.ts porque ese importa node:crypto y no se puede
 * bundlear para el browser: los componentes de cliente importan desde acá.
 */

export type StatsRange = "7d" | "28d" | "90d";

export const STATS_RANGES: { value: StatsRange; label: string; days: number }[] = [
  { value: "7d", label: "7 días", days: 7 },
  { value: "28d", label: "28 días", days: 28 },
  { value: "90d", label: "90 días", days: 90 },
];

export function parseRange(value: string | undefined): StatsRange {
  return STATS_RANGES.some((r) => r.value === value) ? (value as StatsRange) : "28d";
}

export function rangeDays(range: StatsRange): number {
  return STATS_RANGES.find((r) => r.value === range)!.days;
}

export type StatsSummary = {
  users: number;
  sessions: number;
  pageViews: number;
  bounceRate: number; // 0..1
  avgSessionDuration: number; // segundos
};

/** Un día de la serie temporal. `date` en formato 'YYYY-MM-DD'. */
export type DailyPoint = StatsSummary & { date: string };

export type StatsResult =
  | {
      ok: true;
      current: StatsSummary;
      previous: StatsSummary;
      series: DailyPoint[];
      from: string;
      to: string;
    }
  | { ok: false; error: string };

export function formatDuration(seconds: number): string {
  const total = Math.round(seconds);
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-AR").format(Math.round(value));
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/** Variación relativa contra el período anterior. null si no hay base de comparación. */
export function deltaPercent(current: number, previous: number): number | null {
  if (!previous) return null;
  return (current - previous) / previous;
}
