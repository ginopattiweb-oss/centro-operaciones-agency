/** Configuración de la sección transversal Contenido (redes sociales). */

export const CONTENIDO_TABS = [
  { href: "/contenido", label: "Dashboard" },
  { href: "/contenido/videos", label: "Videos" },
  { href: "/contenido/historias", label: "Historias" },
  { href: "/contenido/planificar", label: "Planificar" },
  { href: "/contenido/inspiracion", label: "Inspiración" },
  { href: "/contenido/cuentas", label: "Cuentas" },
] as const;

export type ContenidoRange = "ayer" | "7d" | "14d" | "28d";

export const CONTENIDO_RANGES: { value: ContenidoRange; label: string; days: number }[] = [
  { value: "ayer", label: "Ayer", days: 1 },
  { value: "7d", label: "7 días", days: 7 },
  { value: "14d", label: "14 días", days: 14 },
  { value: "28d", label: "28 días", days: 28 },
];

export function parseContenidoRange(value: string | undefined): ContenidoRange {
  return CONTENIDO_RANGES.some((range) => range.value === value)
    ? (value as ContenidoRange)
    : "7d";
}

export function contenidoRangeDays(range: ContenidoRange): number {
  return CONTENIDO_RANGES.find((option) => option.value === range)?.days ?? 7;
}

/** Videos por semana que se espera publicar por cuenta de TikTok (tarjeta por cuenta). */
export const WEEKLY_VIDEO_TARGET = 5;

/** Meta diaria de videos publicados sumando todas las plataformas. Es lo que mide "Ritmo de publicación". */
export const DAILY_VIDEO_TARGET = 5;

/** Formato compacto para contadores de redes: 1.1M, 37,2K, 463. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1).replace(".", ",")}K`;
  return new Intl.NumberFormat("es-AR").format(Math.round(value));
}

export function formatSigned(value: number): string {
  const formatted = formatCompact(Math.abs(value));
  return value > 0 ? `+${formatted}` : value < 0 ? `-${formatted}` : formatted;
}

/** Ideas por corrida del generador (Planificar). */
export const IDEA_COUNT_DEFAULT = 5;
export const IDEA_COUNT_MAX = 10;
