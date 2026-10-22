import { fromZonedTime, formatInTimeZone } from "date-fns-tz";
import { endOfWeek, startOfWeek } from "date-fns";
import { es } from "date-fns/locale";

export const TZ = "America/Argentina/Buenos_Aires";

const MESES_ABBR = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

export function nowInBA(): Date {
  return new Date(new Date().toLocaleString("en-US", { timeZone: TZ }));
}

export function formatFriendlyDate(date: Date): string {
  return formatInTimeZone(date, TZ, "EEEE d 'de' MMMM", { locale: es });
}

/** Timestamp completo para el portal y el panel de clientes: '12 mar 2026, 14:30'. */
export function formatDateTime(date: Date): string {
  return formatInTimeZone(date, TZ, "d MMM yyyy, HH:mm", { locale: es });
}

export function startOfWeekUtc(): Date {
  return fromZonedTime(startOfWeek(nowInBA(), { weekStartsOn: 1 }), TZ);
}

/** Domingo de la semana en curso en Buenos Aires, como 'YYYY-MM-DD'. */
export function endOfWeekStringBA(): string {
  return formatInTimeZone(
    fromZonedTime(endOfWeek(nowInBA(), { weekStartsOn: 1 }), TZ),
    TZ,
    "yyyy-MM-dd"
  );
}

export function greeting(): string {
  const hour = nowInBA().getHours();
  if (hour < 12) return "Buen día";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

/** Un instante como fecha suelta 'YYYY-MM-DD' según el calendario de Buenos Aires. */
export function dateStringBA(date: Date): string {
  return formatInTimeZone(date, TZ, "yyyy-MM-dd");
}

/** Fecha de hoy en Buenos Aires como string 'YYYY-MM-DD' (comparable directo con due_start/due_end). */
export function todayStringBA(): string {
  return dateStringBA(new Date());
}

/** Formatea un string 'YYYY-MM-DD' sin pasar por Date/timezone (evita corrimientos de día). */
export function formatShortDateStr(dateStr: string): string {
  const [, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MESES_ABBR[m - 1]}`;
}

/** Igual que `formatShortDateStr` pero con año: '12 mar 2026'. Para fechas contables. */
export function formatFullDateStr(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${d} ${MESES_ABBR[m - 1]} ${y}`;
}

/** Días desde hoy hasta la fecha (negativo = ya pasó). Sin pasar por Date. */
export function daysFromToday(dateStr: string): number {
  const toUtc = (value: string) => {
    const [y, m, d] = value.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(dateStr) - toUtc(todayStringBA())) / 86_400_000);
}

/**
 * Suma días a un 'YYYY-MM-DD' sin pasar por la zona horaria: la aritmética va en
 * UTC y el resultado se vuelve a formatear como fecha suelta.
 */
export function addDaysToDateStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/**
 * Suma meses a un 'YYYY-MM-DD'. Si el día no existe en el mes destino (31 de
 * enero + 1 mes), cae en el último día de ese mes en vez de saltar al siguiente.
 */
export function addMonthsToDateStr(dateStr: string, months: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}
