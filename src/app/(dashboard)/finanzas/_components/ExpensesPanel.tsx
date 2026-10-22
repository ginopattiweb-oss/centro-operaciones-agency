"use client";

/**
 * Gastos. Los fijos (suscripciones, abonos) se cargan una vez y se proyectan
 * solos mes a mes hasta que se les pone fecha de baja; los puntuales pesan
 * únicamente en su mes.
 */
import { useActionState, useEffect, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { formatMoney, type Currency } from "@/lib/finanzas";
import { formatFullDateStr } from "@/lib/date";
import {
  EXPENSE_RECURRENCE_LABELS,
  expenseAmountForMonth,
  formatMonthLong,
  type ExpenseRow,
} from "@/lib/presupuesto";
import { deleteExpense, saveExpense } from "@/lib/actions/presupuesto";
import {
  DeleteButton,
  EmptyRow,
  Field,
  FormMessage,
  GhostButton,
  Modal,
  Panel,
  PrimaryButton,
  inputClass,
} from "@/components/paneles";

type Option = { id: string; name: string };

export function ExpensesPanel({
  expenses,
  month,
  currency,
  unidades,
}: {
  expenses: ExpenseRow[];
  month: string;
  currency: Currency;
  unidades: Option[];
}) {
  const [onlyThisMonth, setOnlyThisMonth] = useState(true);
  const [editing, setEditing] = useState<ExpenseRow | null>(null);
  const [creating, setCreating] = useState(false);

  const inCurrency = expenses.filter((expense) => expense.currency === currency);
  const withMonthAmount = inCurrency.map((expense) => ({
    expense,
    monthCents: expenseAmountForMonth(expense, month),
  }));

  const rows = (onlyThisMonth
    ? withMonthAmount.filter((row) => row.monthCents > 0)
    : withMonthAmount
  ).sort((a, b) => b.monthCents - a.monthCents || a.expense.name.localeCompare(b.expense.name));

  const total = withMonthAmount.reduce((sum, row) => sum + row.monthCents, 0);

  return (
    <>
      <Panel
        title="Gastos"
        hint={`${formatMonthLong(month)}: ${formatMoney(total, currency)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <GhostButton type="button" onClick={() => setOnlyThisMonth((value) => !value)}>
              {onlyThisMonth ? "Ver todos" : "Solo este mes"}
            </GhostButton>
            <PrimaryButton type="button" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" />
              Gasto
            </PrimaryButton>
          </div>
        }
      >
        {rows.length === 0 ? (
          <EmptyRow>
            {onlyThisMonth
              ? `Sin gastos en ${formatMonthLong(month)}.`
              : `No hay gastos cargados en ${currency}.`}
          </EmptyRow>
        ) : (
          <ul className="divide-y divide-border">
            {rows.map(({ expense, monthCents }) => (
              <li key={expense.id} className="flex items-start gap-3 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-2 text-sm text-fg">
                    <span className="truncate">{expense.name}</span>
                    <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-fg-muted">
                      {EXPENSE_RECURRENCE_LABELS[expense.recurrence]}
                    </span>
                  </p>
                  <p className="text-xs text-fg-muted">
                    {expense.recurrence === "unico"
                      ? formatFullDateStr(expense.startsOn)
                      : `Desde ${formatFullDateStr(expense.startsOn)}${
                          expense.endsOn ? ` · hasta ${formatFullDateStr(expense.endsOn)}` : ""
                        }`}
                    {expense.category && ` · ${expense.category}`}
                    {expense.projectName && ` · ${expense.projectName}`}
                  </p>
                </div>

                <span
                  className={`shrink-0 text-sm tabular-nums ${
                    monthCents > 0 ? "text-fg" : "text-fg-muted"
                  }`}
                  title={monthCents > 0 ? "Pesa en este mes" : "No pesa en el mes elegido"}
                >
                  {formatMoney(expense.amountCents, expense.currency)}
                </span>

                <button
                  type="button"
                  onClick={() => setEditing(expense)}
                  className="shrink-0 text-fg-muted hover:text-fg"
                  title="Editar gasto"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {(creating || editing) && (
        <ExpenseModal
          expense={editing}
          month={month}
          currency={currency}
          unidades={unidades}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </>
  );
}

function ExpenseModal({
  expense,
  month,
  currency,
  unidades,
  onClose,
}: {
  expense: ExpenseRow | null;
  month: string;
  currency: Currency;
  unidades: Option[];
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(saveExpense, null);
  const [recurrence, setRecurrence] = useState(expense?.recurrence ?? "mensual");

  useEffect(() => {
    if (state?.success) onClose();
  }, [state, onClose]);

  return (
    <Modal title={expense ? "Editar gasto" : "Nuevo gasto"} onClose={onClose}>
      <form action={formAction} className="flex flex-col gap-4">
        {expense && <input type="hidden" name="id" value={expense.id} />}

        <Field label="Gasto">
          <input
            name="name"
            required
            defaultValue={expense?.name ?? ""}
            placeholder="Ej: Figma, Vercel, alquiler"
            className={inputClass}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto">
            <input
              name="amount"
              required
              inputMode="decimal"
              defaultValue={expense ? (expense.amountCents / 100).toLocaleString("es-AR") : ""}
              placeholder="25.000"
              className={inputClass}
            />
          </Field>

          <Field label="Moneda">
            <select
              name="currency"
              defaultValue={expense?.currency ?? currency}
              className={inputClass}
            >
              <option value="ARS">Pesos (ARS)</option>
              <option value="USD">Dólares (USD)</option>
            </select>
          </Field>
        </div>

        <Field
          label="Frecuencia"
          hint={
            recurrence === "unico"
              ? "Pesa solo en el mes de la fecha."
              : "Se proyecta solo hasta la fecha de baja."
          }
        >
          <select
            name="recurrence"
            value={recurrence}
            onChange={(event) =>
              setRecurrence(event.target.value as ExpenseRow["recurrence"])
            }
            className={inputClass}
          >
            <option value="mensual">Mensual</option>
            <option value="anual">Anual</option>
            <option value="unico">Único</option>
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={recurrence === "unico" ? "Fecha" : "Desde"}>
            <input
              type="date"
              name="startsOn"
              required
              defaultValue={expense?.startsOn ?? `${month}-01`}
              className={inputClass}
            />
          </Field>

          {recurrence !== "unico" && (
            <Field label="Hasta" hint="Vacío = sigue vigente.">
              <input
                type="date"
                name="endsOn"
                defaultValue={expense?.endsOn ?? ""}
                className={inputClass}
              />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Rubro">
            <input
              name="category"
              defaultValue={expense?.category ?? ""}
              placeholder="Software, oficina…"
              className={inputClass}
            />
          </Field>

          <Field label="Unidad">
            <select
              name="projectId"
              defaultValue={expense?.projectId ?? "none"}
              className={inputClass}
            >
              <option value="none">Sin unidad</option>
              {unidades.map((unidad) => (
                <option key={unidad.id} value={unidad.id}>
                  {unidad.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <FormMessage state={state} />

        <div className="flex items-center justify-between gap-2">
          {expense ? (
            <DeleteButton
              onDelete={async () => {
                await deleteExpense(expense.id);
                onClose();
              }}
            />
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            <GhostButton type="button" onClick={onClose}>
              Cancelar
            </GhostButton>
            <PrimaryButton type="submit" disabled={isPending}>
              {isPending ? "Guardando…" : "Guardar"}
            </PrimaryButton>
          </div>
        </div>
      </form>
    </Modal>
  );
}
