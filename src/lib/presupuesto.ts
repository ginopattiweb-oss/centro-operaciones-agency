/**
 * Finanzas transversales — cálculo puro, sin nada de servidor.
 *
 * Mismo criterio que `lib/finanzas.ts`: nada agregado se guarda. Los totales por
 * mes (estimado, cobrado, gastos, neto) se derivan siempre de lo cargado —
 * conceptos del presupuesto, ingresos manuales, comprobantes de clientes y gastos.
 *
 * Los meses son strings 'YYYY-MM': comparan y ordenan como texto, sin pasar por
 * Date, así que no hay corrimientos de zona horaria.
 * Los montos van en centavos enteros: sumar floats de dinero pierde centavos.
 */
import type { Currency, ExpenseRecurrence } from "@/db/schema";
import { toCents } from "@/lib/finanzas";

export type { ExpenseRecurrence };

export const EXPENSE_RECURRENCE_LABELS: Record<ExpenseRecurrence, string> = {
  unico: "Único",
  mensual: "Mensual",
  anual: "Anual",
};

export function isExpenseRecurrence(value: unknown): value is ExpenseRecurrence {
  return value === "unico" || value === "mensual" || value === "anual";
}

// --- Meses ---

const MESES_ABBR = [
  "ene", "feb", "mar", "abr", "may", "jun",
  "jul", "ago", "sep", "oct", "nov", "dic",
];

/** 'YYYY-MM-DD' → 'YYYY-MM'. También acepta un mes ya cortado. */
export function monthOf(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function isMonthKey(value: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  return true;
}

/** Mes ± n. `addMonths('2025-12', 1)` → '2026-01'. */
export function addMonths(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const total = year * 12 + (monthIndex - 1) + delta;
  return `${String(Math.floor(total / 12)).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
}

/** Cantidad de meses de `from` a `to`, inclusive en ambos extremos. */
export function monthsBetween(from: string, to: string): number {
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

/** Lista continua de meses de `from` a `to`, inclusive. */
export function monthRange(from: string, to: string): string[] {
  const span = monthsBetween(from, to);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, index) => addMonths(from, index));
}

/** 'ago-25', como en la planilla. */
export function formatMonthShort(month: string): string {
  const [year, monthIndex] = month.split("-");
  return `${MESES_ABBR[Number(monthIndex) - 1]}-${year.slice(2)}`;
}

/** 'agosto 2025', para títulos. */
export function formatMonthLong(month: string): string {
  const nombres = [
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
  ];
  const [year, monthIndex] = month.split("-");
  return `${nombres[Number(monthIndex) - 1]} ${year}`;
}

/** Primer y último día del mes, como 'YYYY-MM-DD'. */
export function monthBounds(month: string): { first: string; last: string } {
  const [year, monthIndex] = month.split("-").map(Number);
  const days = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  return { first: `${month}-01`, last: `${month}-${String(days).padStart(2, "0")}` };
}

// --- Filas que entran al cálculo ---

export type BudgetConceptView = {
  id: string;
  name: string;
  projectId: string | null;
  projectName: string | null;
  clientProjectId: string | null;
  clientProjectName: string | null;
  currency: Currency;
  archived: boolean;
  notes: string | null;
  /** Estimado por mes: 'YYYY-MM' → centavos. Sólo los meses cargados. */
  estimated: Record<string, number>;
  /** Cobrado por mes: comprobantes del cliente + ingresos manuales del concepto. */
  received: Record<string, number>;
};

export type IncomeRowKind = "cliente" | "manual";

/** Un ingreso ya cobrado: factura de cliente o carga manual. */
export type IncomeRow = {
  id: string;
  kind: IncomeRowKind;
  description: string;
  receivedAt: string;
  amountCents: number;
  currency: Currency;
  projectId: string | null;
  projectName: string | null;
  conceptId: string | null;
  method: string | null;
  /** Sólo en los de cliente: para linkear al proyecto. */
  clientProjectId: string | null;
};

export type ExpenseRow = {
  id: string;
  name: string;
  amountCents: number;
  currency: Currency;
  recurrence: ExpenseRecurrence;
  startsOn: string;
  endsOn: string | null;
  category: string | null;
  projectId: string | null;
  projectName: string | null;
  notes: string | null;
};

// --- Gastos proyectados ---

/**
 * Si el gasto pega en ese mes, cuánto. No se guardan filas por mes: un abono
 * mensual de 2024 sigue apareciendo en 2026 mientras no tenga fecha de baja.
 */
export function expenseAmountForMonth(expense: ExpenseRow, month: string): number {
  const start = monthOf(expense.startsOn);
  if (month < start) return 0;
  if (expense.endsOn && month > monthOf(expense.endsOn)) return 0;

  switch (expense.recurrence) {
    case "unico":
      return month === start ? expense.amountCents : 0;
    case "mensual":
      return expense.amountCents;
    case "anual":
      // Cae en el mismo mes del año que la fecha de alta.
      return month.slice(5) === start.slice(5) ? expense.amountCents : 0;
  }
}

/** Gastos vigentes en el mes, del más caro al más barato. */
export function expensesForMonth(expenses: ExpenseRow[], month: string) {
  return expenses
    .map((expense) => ({ expense, amountCents: expenseAmountForMonth(expense, month) }))
    .filter((row) => row.amountCents > 0)
    .sort((a, b) => b.amountCents - a.amountCents);
}

// --- Totales por mes ---

export type MonthTotals = {
  month: string;
  estimatedCents: number;
  receivedCents: number;
  expensesCents: number;
  /** Cobrado menos gastos. Puede ser negativo. */
  netCents: number;
};

export function monthlyTotals(
  months: string[],
  concepts: BudgetConceptView[],
  incomes: IncomeRow[],
  expenses: ExpenseRow[],
  currency: Currency
): MonthTotals[] {
  const receivedByMonth = new Map<string, number>();
  for (const income of incomes) {
    if (income.currency !== currency) continue;
    const month = monthOf(income.receivedAt);
    receivedByMonth.set(month, (receivedByMonth.get(month) ?? 0) + income.amountCents);
  }

  return months.map((month) => {
    let estimatedCents = 0;
    for (const concept of concepts) {
      if (concept.currency !== currency) continue;
      estimatedCents += concept.estimated[month] ?? 0;
    }

    const expensesCents = expenses
      .filter((expense) => expense.currency === currency)
      .reduce((sum, expense) => sum + expenseAmountForMonth(expense, month), 0);

    const receivedCents = receivedByMonth.get(month) ?? 0;

    return {
      month,
      estimatedCents,
      receivedCents,
      expensesCents,
      netCents: receivedCents - expensesCents,
    };
  });
}

/** Cumplimiento del mes: cobrado sobre estimado, 0–1+. Null si no hay estimado. */
export function completionRatio(totals: MonthTotals): number | null {
  if (totals.estimatedCents <= 0) return null;
  return totals.receivedCents / totals.estimatedCents;
}

/** Variación contra el mes anterior, en porcentaje. Null si no hay base de comparación. */
export function monthOverMonth(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

/** Monedas que tienen algún dato cargado. Si no hay nada, ARS para no dejar la vista vacía. */
export function currenciesInUse(
  concepts: BudgetConceptView[],
  incomes: IncomeRow[],
  expenses: ExpenseRow[]
): Currency[] {
  const used = new Set<Currency>();
  for (const concept of concepts) {
    if (Object.keys(concept.estimated).length > 0) used.add(concept.currency);
  }
  for (const income of incomes) used.add(income.currency);
  for (const expense of expenses) used.add(expense.currency);
  if (used.size === 0) return ["ARS"];
  return (["ARS", "USD"] as Currency[]).filter((currency) => used.has(currency));
}

/** `numeric` de la DB → centavos, tolerando null. */
export function centsOrZero(value: string | null | undefined): number {
  return value ? toCents(value) : 0;
}

/** Monto abreviado para ejes y barras: '1,2 M', '850 k'. */
export function formatMoneyShort(cents: number, currency: Currency): string {
  const symbol = currency === "USD" ? "US$" : "$";
  const value = Math.abs(cents) / 100;
  const sign = cents < 0 ? "-" : "";
  if (value >= 1_000_000) {
    return `${sign}${symbol}${(value / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })} M`;
  }
  if (value >= 1_000) {
    return `${sign}${symbol}${(value / 1_000).toLocaleString("es-AR", { maximumFractionDigits: 0 })} k`;
  }
  return `${sign}${symbol}${value.toLocaleString("es-AR", { maximumFractionDigits: 0 })}`;
}
