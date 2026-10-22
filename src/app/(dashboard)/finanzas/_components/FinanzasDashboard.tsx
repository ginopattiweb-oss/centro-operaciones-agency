"use client";

/**
 * Dashboard de finanzas transversales. Toda la interacción vive acá arriba: el
 * mes elegido y la moneda mandan sobre el gráfico, las tarjetas y los paneles.
 * Los datos llegan calculados del servidor; acá sólo se filtra y se agrega.
 */
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { formatMoney, type Currency } from "@/lib/finanzas";
import {
  completionRatio,
  formatMonthLong,
  monthOverMonth,
  monthlyTotals,
} from "@/lib/presupuesto";
import type { FinanzasTransversal } from "@/lib/presupuesto-queries";
import { CashflowChart } from "./CashflowChart";
import { BudgetGrid } from "./BudgetGrid";
import { IncomePanel } from "./IncomePanel";
import { ExpensesPanel } from "./ExpensesPanel";

/** Meses que entran en el gráfico: los 9 previos al elegido y 2 hacia adelante. */
const CHART_BACK = 9;
const CHART_FORWARD = 2;

export function FinanzasDashboard({ data }: { data: FinanzasTransversal }) {
  const { months, currentMonth, concepts, incomes, expenses, currencies, unidades, clientes } =
    data;

  const [currency, setCurrency] = useState<Currency>(currencies[0] ?? "ARS");
  const [month, setMonth] = useState(
    months.includes(currentMonth) ? currentMonth : months[months.length - 1]
  );

  const totals = useMemo(
    () => monthlyTotals(months, concepts, incomes, expenses, currency),
    [months, concepts, incomes, expenses, currency]
  );

  const index = months.indexOf(month);
  const current = totals[index];
  const previous = index > 0 ? totals[index - 1] : null;

  const chartTotals = totals.slice(
    Math.max(0, index - CHART_BACK),
    Math.min(totals.length, index + CHART_FORWARD + 1)
  );

  const ratio = current ? completionRatio(current) : null;
  const receivedChange = previous
    ? monthOverMonth(current.receivedCents, previous.receivedCents)
    : null;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-fg-muted">Transversal · todas las unidades</p>
          <h1 className="mt-1 font-heading text-3xl text-fg">Finanzas</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currencies.length > 1 && (
            <div className="flex gap-1 rounded-lg border border-border bg-surface p-1">
              {currencies.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setCurrency(option)}
                  className={`rounded-md px-3 py-1.5 text-xs transition ${
                    currency === option
                      ? "bg-accent/15 text-accent-ink"
                      : "text-fg-muted hover:text-fg"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1">
            <button
              type="button"
              disabled={index <= 0}
              onClick={() => setMonth(months[index - 1])}
              className="rounded-md p-1.5 text-fg-muted hover:text-fg disabled:opacity-40"
              aria-label="Mes anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="min-w-[8.5rem] text-center text-sm capitalize text-fg">
              {formatMonthLong(month)}
            </span>
            <button
              type="button"
              disabled={index >= months.length - 1}
              onClick={() => setMonth(months[index + 1])}
              className="rounded-md p-1.5 text-fg-muted hover:text-fg disabled:opacity-40"
              aria-label="Mes siguiente"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {month !== currentMonth && (
            <button
              type="button"
              onClick={() => setMonth(currentMonth)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted hover:text-fg"
            >
              Hoy
            </button>
          )}
        </div>
      </header>

      <section className="rounded-card border border-border bg-surface p-5">
        <CashflowChart
          totals={chartTotals}
          currency={currency}
          selectedMonth={month}
          currentMonth={currentMonth}
          onSelectMonth={setMonth}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Cobrado"
          value={formatMoney(current?.receivedCents ?? 0, currency)}
          footer={
            receivedChange === null ? (
              "Sin base de comparación"
            ) : (
              <span
                className={`flex items-center gap-1 ${
                  receivedChange >= 0 ? "text-positive" : "text-negative"
                }`}
              >
                {receivedChange >= 0 ? (
                  <TrendingUp className="h-3.5 w-3.5" />
                ) : (
                  <TrendingDown className="h-3.5 w-3.5" />
                )}
                {`${receivedChange >= 0 ? "+" : ""}${receivedChange.toFixed(0)}% vs mes anterior`}
              </span>
            )
          }
        />
        <StatCard
          label="Estimado"
          value={formatMoney(current?.estimatedCents ?? 0, currency)}
          footer={
            ratio === null
              ? "Sin presupuesto cargado"
              : `Cumplido: ${Math.round(ratio * 100)}%`
          }
          accent={ratio !== null && ratio >= 1}
        />
        <StatCard
          label="Gastos"
          value={formatMoney(current?.expensesCents ?? 0, currency)}
          footer="Fijos proyectados + puntuales"
        />
        <StatCard
          label="Neto"
          value={formatMoney(current?.netCents ?? 0, currency)}
          footer="Cobrado menos gastos"
          negative={(current?.netCents ?? 0) < 0}
        />
      </section>

      <BudgetGrid
        concepts={concepts}
        months={months}
        selectedMonth={month}
        currentMonth={currentMonth}
        currency={currency}
        unidades={unidades}
        clientes={clientes}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <IncomePanel
          incomes={incomes}
          month={month}
          currency={currency}
          unidades={unidades}
          concepts={concepts}
        />
        <ExpensesPanel
          expenses={expenses}
          month={month}
          currency={currency}
          unidades={unidades}
        />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  footer,
  accent = false,
  negative = false,
}: {
  label: string;
  value: string;
  footer: React.ReactNode;
  accent?: boolean;
  negative?: boolean;
}) {
  return (
    <div className="rounded-card border border-border bg-surface p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-fg-muted">{label}</p>
      <p
        className={`mt-2 font-heading text-2xl tabular-nums ${
          negative ? "text-negative" : accent ? "text-accent-ink" : "text-fg"
        }`}
      >
        {value}
      </p>
      <div className="mt-2 text-xs text-fg-muted">{footer}</div>
    </div>
  );
}
